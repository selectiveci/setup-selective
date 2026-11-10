import * as core from '@actions/core'
import { buildMetadata } from './metadata.js'
import { plan, warmup } from './selective.js'

const DEFAULT_HOST = 'https://app.selective.ci'

function intInput(name: string, fallback: number): number {
  const raw = core.getInput(name)
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive whole number, got "${raw}"`)
  }
  return value
}

function setOutputs(runners: number, status: string): void {
  core.setOutput('runners', runners)
  core.setOutput(
    'matrix',
    JSON.stringify(Array.from({ length: runners }, (_, i) => i))
  )
  core.setOutput('status', status)
}

/**
 * Warms up the commit's selection, waits for Selective's plan, and outputs
 * how many runners to start.
 */
export async function run(): Promise<void> {
  try {
    const maxRunners = intInput('max-runners', 0)
    if (!maxRunners) throw new Error('max-runners is required')

    const apiKey = core.getInput('api-key') || process.env.SELECTIVE_API_KEY
    // Pull requests from forks get no secrets; the test job still needs a
    // matrix.
    if (!apiKey) {
      core.warning(
        `No Selective API key, so no plan: using max-runners (${maxRunners}).`
      )
      setOutputs(maxRunners, 'fallback')
      return
    }

    const host =
      core.getInput('host') || process.env.SELECTIVE_HOST || DEFAULT_HOST
    const metadata = buildMetadata(process.env, {
      language: core.getInput('language'),
      framework: core.getInput('framework'),
      runtime_version: core.getInput('runtime-version')
    })

    core.info(`warmup: ${await warmup(host, apiKey, metadata)}`)

    const result = await plan({
      host,
      apiKey,
      metadata,
      maxRunners,
      minRunners: Math.min(intInput('min-runners', 1), maxRunners),
      targetSeconds: intInput('target-seconds', 120),
      timeoutSeconds: intInput('timeout-seconds', 90),
      log: core.debug
    })

    const reason = result.detail ? ` (${result.detail})` : ''
    core.info(`Selective: ${result.runners} runners, ${result.status}${reason}`)
    setOutputs(result.runners, result.status)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
