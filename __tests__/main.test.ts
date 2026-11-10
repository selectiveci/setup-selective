import * as core from '@actions/core'
import { run } from '../src/main'
import * as selective from '../src/selective'

// Mock the core.exportVariable function
jest.mock('@actions/core', () => ({
  exportVariable: jest.fn(),
  setFailed: jest.fn(),
  getInput: jest.fn(),
  setOutput: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn()
}))

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

// Mock the github.context object
jest.mock('@actions/github', () => ({
  context: {
    eventName: 'pull_request',
    payload: {
      pull_request: {
        title: 'Test Pull Request'
      }
    }
  }
}))

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exports SELECTIVE_RUNNER_ID variable', async () => {
    // Mock the getInput function
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock)
      .mockReturnValueOnce('test-api-key')
      .mockReturnValueOnce('1')

    await run()

    expect(core.exportVariable).toHaveBeenCalledWith('SELECTIVE_RUNNER_ID', '1')
  })

  it('exports SELECTIVE_PR_TITLE variable for pull_request event', async () => {
    // Mock the getInput function
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock)
      .mockReturnValueOnce('test-api-key')
      .mockReturnValueOnce('1')

    await run()

    expect(core.exportVariable).toHaveBeenCalledWith(
      'SELECTIVE_PR_TITLE',
      'Test Pull Request'
    )
  })

  it('exports SELECTIVE_API_KEY variable if api-key input is provided', async () => {
    // Mock the getInput function to return an API key
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock)
      .mockReturnValueOnce('test-api-key')
      .mockReturnValueOnce('1')

    await run()

    expect(core.exportVariable).toHaveBeenCalledWith(
      'SELECTIVE_API_KEY',
      'test-api-key'
    )
  })

  it('throws an error if neither api-key input nor SELECTIVE_API_KEY environment variable is provided', async () => {
    // Mock the getInput function to return undefined
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock)
      .mockReturnValueOnce(undefined) // For api-key
      .mockReturnValueOnce(undefined) // For runner-id

    // Clear the SELECTIVE_API_KEY environment variable
    delete process.env.SELECTIVE_API_KEY

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'API key is required. Please provide a value for api-key input or set SELECTIVE_API_KEY environment variable.'
    )
  })

  it('does not throw an error if api-key input is not provided but SELECTIVE_API_KEY environment variable is set', async () => {
    // Mock the getInput function to return undefined
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('1')

    // Set the SELECTIVE_API_KEY environment variable
    process.env.SELECTIVE_API_KEY = 'test-api-key'

    await expect(run()).resolves.not.toThrow()
  })

  it('fails the workflow run if an error occurs', async () => {
    // Mock the getInput function
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock).mockReturnValueOnce('1')

    const error = new Error('Test error')
    jest.spyOn(core, 'exportVariable').mockImplementation(() => {
      throw error
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(error.message)
  })

  describe('planning runners', () => {
    beforeEach(() => {
      // eslint-disable-next-line no-extra-semi
      ;(core.exportVariable as jest.Mock).mockImplementation(() => {})
      process.env.SELECTIVE_API_KEY = 'env-key'
    })

    it('does nothing remote by default', async () => {
      inputs({ 'api-key': 'key' })
      await run()
      expect(selective.warmup).not.toHaveBeenCalled()
      expect(selective.plan).not.toHaveBeenCalled()
    })

    it('warms up without planning when warmup is true', async () => {
      inputs({ 'api-key': 'key', warmup: 'true' })
      await run()
      expect(selective.warmup).toHaveBeenCalled()
      expect(selective.plan).not.toHaveBeenCalled()
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

    it('plans max-runners without a key, as on a pull request from a fork', async () => {
      delete process.env.SELECTIVE_API_KEY
      inputs({ 'max-runners': '4' })

      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(selective.warmup).not.toHaveBeenCalled()
      expect(core.setOutput).toHaveBeenCalledWith('matrix', '[0,1,2,3]')
      expect(core.setOutput).toHaveBeenCalledWith('status', 'fallback')
    })

    it('rejects a max-runners that is not a positive whole number', async () => {
      inputs({ 'api-key': 'key', 'max-runners': 'lots' })
      await run()
      expect(core.setFailed).toHaveBeenCalledWith(
        'max-runners must be a positive whole number, got "lots"'
      )
    })
  })
})
