import * as core from '@actions/core'
import { run } from '../src/plan'
import * as selective from '../src/selective'

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn()
}))

jest.mock('@actions/github', () => ({ context: { payload: {} } }))

jest.mock('../src/selective', () => ({
  warmup: jest.fn(async () => 'HTTP 202'),
  plan: jest.fn()
}))

function inputs(values: Record<string, string>): void {
  // eslint-disable-next-line no-extra-semi
  ;(core.getInput as jest.Mock).mockImplementation(
    (name: string) => values[name] ?? ''
  )
}

describe('plan action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.SELECTIVE_API_KEY
  })

  it('warms up, plans and sets the runners and matrix outputs', async () => {
    inputs({ 'api-key': 'key', 'max-runners': '20', 'min-runners': '30' })
    ;(selective.plan as jest.Mock).mockResolvedValueOnce({
      runners: 3,
      status: 'selected'
    })

    await run()

    expect(selective.warmup).toHaveBeenCalled()
    expect(selective.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'key',
        maxRunners: 20,
        minRunners: 20,
        targetSeconds: 120,
        timeoutSeconds: 90
      })
    )
    expect(core.setOutput).toHaveBeenCalledWith('runners', 3)
    expect(core.setOutput).toHaveBeenCalledWith('matrix', '[0,1,2]')
    expect(core.setOutput).toHaveBeenCalledWith('status', 'selected')
  })

  it('uses SELECTIVE_API_KEY when api-key is not given', async () => {
    process.env.SELECTIVE_API_KEY = 'env-key'
    inputs({ 'max-runners': '4' })
    ;(selective.plan as jest.Mock).mockResolvedValueOnce({
      runners: 4,
      status: 'full'
    })

    await run()

    expect(selective.plan).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'env-key' })
    )
  })

  it('plans max-runners without a key, as on a pull request from a fork', async () => {
    inputs({ 'max-runners': '4' })

    await run()

    expect(core.setFailed).not.toHaveBeenCalled()
    expect(selective.warmup).not.toHaveBeenCalled()
    expect(core.setOutput).toHaveBeenCalledWith('matrix', '[0,1,2,3]')
    expect(core.setOutput).toHaveBeenCalledWith('status', 'fallback')
  })

  it('requires max-runners', async () => {
    inputs({ 'api-key': 'key' })
    await run()
    expect(core.setFailed).toHaveBeenCalledWith('max-runners is required')
  })

  it('rejects a max-runners that is not a positive whole number', async () => {
    inputs({ 'api-key': 'key', 'max-runners': 'lots' })
    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      'max-runners must be a positive whole number, got "lots"'
    )
  })
})
