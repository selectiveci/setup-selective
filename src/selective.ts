import type { Metadata } from './metadata'

export interface PlanOptions {
  host: string
  apiKey: string
  metadata: Metadata
  maxRunners: number
  minRunners: number
  targetSeconds: number
  timeoutSeconds: number
  log?: (message: string) => void
}

export interface Plan {
  runners: number
  status: string
  detail?: string
}

const WAIT_SECONDS = 20
const WARMUP_TIMEOUT_MS = 20_000

// The runners' host is a websocket URL; the HTTP API lives on the same host.
export function httpHost(host: string): string {
  return host
    .trim()
    .replace(/^wss:/, 'https:')
    .replace(/^ws:/, 'http:')
    .replace(/\/+$/, '')
}

async function post(
  url: string,
  apiKey: string,
  body: object,
  timeoutMs: number
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  })
  let json: Record<string, unknown> | null = null
  try {
    json = (await response.json()) as Record<string, unknown>
  } catch {
    json = null
  }
  return { status: response.status, json }
}

export async function warmup(
  host: string,
  apiKey: string,
  metadata: Metadata
): Promise<string> {
  try {
    const { status, json } = await post(
      `${httpHost(host)}/warmup`,
      apiKey,
      metadata,
      WARMUP_TIMEOUT_MS
    )
    return `HTTP ${status} ${JSON.stringify(json)}`
  } catch (error) {
    return `failed: ${(error as Error).message}`
  }
}

// Asks Selective how many runners the suite needs for this change, waiting
// while the decision is still being prepared. Anything short of a valid
// answer within the timeout falls back to maxRunners.
export async function plan(options: PlanOptions): Promise<Plan> {
  const { host, apiKey, metadata, maxRunners, minRunners } = options
  const log = options.log ?? (() => {})
  const deadline = Date.now() + options.timeoutSeconds * 1000
  const body = {
    ...metadata,
    max: maxRunners,
    min: minRunners,
    target_seconds: options.targetSeconds,
    wait_seconds: WAIT_SECONDS
  }

  let detail = 'no answer before the timeout'
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now()
    try {
      const { status, json } = await post(
        `${httpHost(host)}/plan`,
        apiKey,
        body,
        Math.min(remaining, (WAIT_SECONDS + 10) * 1000)
      )
      if (status !== 200 || !json) {
        detail = `HTTP ${status} ${JSON.stringify(json)}`
        break
      }
      log(`plan: ${JSON.stringify(json)}`)
      if (json.status === 'pending') continue

      const runners = json.shards
      if (
        typeof runners === 'number' &&
        Number.isInteger(runners) &&
        runners >= 1 &&
        runners <= maxRunners
      ) {
        return {
          runners,
          status: String(json.status),
          detail: json.reason ? String(json.reason) : undefined
        }
      }
      detail = `invalid answer ${JSON.stringify(json)}`
      break
    } catch (error) {
      detail = (error as Error).message
      break
    }
  }
  return { runners: maxRunners, status: 'fallback', detail }
}
