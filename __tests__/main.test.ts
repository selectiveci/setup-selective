import * as core from '@actions/core'
import { run } from '../src/main'

// Mock the core.exportVariable function
jest.mock('@actions/core', () => ({
  exportVariable: jest.fn(),
  setFailed: jest.fn(),
  getInput: jest.fn()
}))

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

  it('exports SELECTIVE_RUNNER_ID, SELECTIVE_RUN_ID, and SELECTIVE_RUN_ATTEMPT variables', async () => {
    // Mock the getInput function
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock)
      .mockReturnValueOnce('test-api-key')
      .mockReturnValueOnce('1')

    await run()

    expect(core.exportVariable).toHaveBeenCalledWith('SELECTIVE_RUNNER_ID', '1')
    expect(core.exportVariable).toHaveBeenCalledWith(
      'SELECTIVE_RUN_ID',
      process.env.GITHUB_RUN_ID
    )
    expect(core.exportVariable).toHaveBeenCalledWith(
      'SELECTIVE_RUN_ATTEMPT',
      process.env.GITHUB_RUN_ATTEMPT
    )
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
})
