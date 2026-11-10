import { httpHost, plan, warmup } from '../src/selective'

const options = {
  host: 'https://selective.test',
  apiKey: 'key',
  metadata: { sha: 'abc' },
  maxRunners: 20,
  minRunners: 2,
  targetSeconds: 120,
  timeoutSeconds: 5
}

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('httpHost', () => {
  it('turns the runners websocket host into the HTTP API host', () => {
    expect(httpHost('wss://app.selective.ci')).toBe('https://app.selective.ci')
    expect(httpHost('ws://localhost:4000/')).toBe('http://localhost:4000')
    expect(httpHost('https://app.selective.ci')).toBe(
      'https://app.selective.ci'
    )
  })
})

describe('plan', () => {
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch')
  })

  afterEach(() => fetchMock.mockRestore())

  it('sends the change and sizing to /plan and returns the answer', async () => {
    fetchMock.mockResolvedValueOnce(
      respond(200, { status: 'selected', shards: 5 })
    )

    expect(await plan(options)).toEqual({
      runners: 5,
      status: 'selected',
      detail: undefined
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://selective.test/plan')
    expect(init.headers.authorization).toBe('key')
    expect(JSON.parse(init.body)).toEqual({
      sha: 'abc',
      max: 20,
      min: 2,
      target_seconds: 120,
      wait_seconds: 20
    })
  })

  it('asks again while the decision is pending', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, { status: 'pending', shards: 20 }))
      .mockResolvedValueOnce(
        respond(200, { status: 'full', shards: 20, reason: 'not live' })
      )

    expect(await plan(options)).toEqual({
      runners: 20,
      status: 'full',
      detail: 'not live'
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['an error response', () => respond(401, { error: 'bad key' })],
    [
      'an out-of-range answer',
      () => respond(200, { status: 'selected', shards: 99 })
    ],
    [
      'a non-integer answer',
      () => respond(200, { status: 'selected', shards: 2.5 })
    ]
  ])('falls back to max-runners on %s', async (_label, response) => {
    fetchMock.mockResolvedValueOnce(response())
    const result = await plan(options)
    expect(result.runners).toBe(20)
    expect(result.status).toBe('fallback')
  })

  it('falls back to max-runners when the request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connection refused'))
    expect(await plan(options)).toEqual({
      runners: 20,
      status: 'fallback',
      detail: 'connection refused'
    })
  })

  it('falls back to max-runners when still pending at the timeout', async () => {
    fetchMock.mockImplementation(async () =>
      respond(200, { status: 'pending', shards: 20 })
    )
    const result = await plan({ ...options, timeoutSeconds: 0.05 })
    expect(result).toEqual({
      runners: 20,
      status: 'fallback',
      detail: 'no answer before the timeout'
    })
  })
})

describe('warmup', () => {
  it('posts the change to /warmup and reports the response', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(respond(202, { semantic: 'queued' }))

    expect(await warmup('wss://selective.test', 'key', { sha: 'abc' })).toBe(
      'HTTP 202 {"semantic":"queued"}'
    )
    expect(fetchMock.mock.calls[0][0]).toBe('https://selective.test/warmup')
    fetchMock.mockRestore()
  })

  it('never throws', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('timeout'))
    expect(await warmup('https://selective.test', 'key', {})).toBe(
      'failed: timeout'
    )
    fetchMock.mockRestore()
  })
})
