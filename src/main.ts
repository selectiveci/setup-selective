import * as core from '@actions/core'
import * as github from '@actions/github'

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
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
