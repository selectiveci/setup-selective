import * as core from '@actions/core'
import * as github from '@actions/github'
import { buildMetadata } from './metadata'
import { plan, warmup } from './selective'

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

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const apiKey = core.getInput('api-key', { required: false })
    const runnerId = core.getInput('runner-id', { required: false })

    // Check if either apiKey or SELECTIVE_API_KEY is set
    if (!apiKey && !process.env.SELECTIVE_API_KEY) {
      throw new Error(
        'API key is required. Please provide a value for api-key input or set SELECTIVE_API_KEY environment variable.'
      )
    }

    // Set the environment variables for the action
    if (apiKey) {
      core.exportVariable('SELECTIVE_API_KEY', apiKey)
    }

    if (runnerId) {
      core.exportVariable('SELECTIVE_RUNNER_ID', runnerId)
    }

    if (github.context.eventName === 'pull_request') {
      core.exportVariable(
        'SELECTIVE_PR_TITLE',
        github.context.payload.pull_request?.title
      )
    }

    const maxRunners = core.getInput('max-runners')
      ? intInput('max-runners', 1)
      : undefined
    const doWarmup =
      (core.getInput('warmup') || '').toLowerCase() === 'true' ||
      maxRunners !== undefined
    if (!doWarmup) return

    const key = (apiKey || process.env.SELECTIVE_API_KEY) as string
    const host =
      core.getInput('host') || process.env.SELECTIVE_HOST || DEFAULT_HOST
    const metadata = buildMetadata(process.env, {
      language: core.getInput('language'),
      framework: core.getInput('framework'),
      runtime_version: core.getInput('runtime-version')
    })

    core.info(`warmup: ${await warmup(host, key, metadata)}`)
    if (maxRunners === undefined) return

    const result = await plan({
      host,
      apiKey: key,
      metadata,
      maxRunners,
      minRunners: Math.min(intInput('min-runners', 1), maxRunners),
      targetSeconds: intInput('target-seconds', 120),
      timeoutSeconds: intInput('timeout-seconds', 90),
      log: core.debug
    })

    const reason = result.detail ? ` (${result.detail})` : ''
    core.info(`Selective: ${result.runners} runners, ${result.status}${reason}`)
    core.setOutput('runners', result.runners)
    core.setOutput(
      'matrix',
      JSON.stringify(Array.from({ length: result.runners }, (_, i) => i))
    )
    core.setOutput('status', result.status)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
