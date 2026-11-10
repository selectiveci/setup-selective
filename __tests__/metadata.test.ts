import * as github from '@actions/github'
import { buildMetadata } from '../src/metadata'

jest.mock('@actions/github', () => ({ context: { payload: {} } }))

const context = github.context as { payload: Record<string, unknown> }

const prEnv = {
  GITHUB_SHA: 'merge-sha',
  GITHUB_HEAD_REF: 'feature',
  GITHUB_REF_NAME: '12/merge',
  GITHUB_BASE_REF: 'main',
  GITHUB_REPOSITORY: 'acme/app'
}

describe('buildMetadata', () => {
  it('describes a pull request the way the test runners do', () => {
    context.payload = { pull_request: { base: { sha: 'base-sha' } } }

    expect(buildMetadata(prEnv)).toEqual({
      sha: 'merge-sha',
      base_sha: 'base-sha',
      branch: 'feature',
      target_branch: 'main',
      git_repo_full_name: 'acme/app'
    })
  })

  it('uses the previous commit as the base of a push', () => {
    context.payload = { before: 'previous-sha' }

    expect(
      buildMetadata({
        GITHUB_SHA: 'new-sha',
        GITHUB_REF_NAME: 'main',
        GITHUB_REPOSITORY: 'acme/app'
      })
    ).toMatchObject({
      base_sha: 'previous-sha',
      branch: 'main',
      target_branch: ''
    })
  })

  it('has no base for the first push of a branch', () => {
    context.payload = { before: '0000000000000000000000000000000000000000' }
    expect(buildMetadata({ GITHUB_SHA: 'x' }).base_sha).toBe('')
  })

  it('honours the same SELECTIVE_ overrides as the runners', () => {
    context.payload = { pull_request: { base: { sha: 'base-sha' } } }

    expect(
      buildMetadata({
        ...prEnv,
        SELECTIVE_SHA: 'head-sha',
        SELECTIVE_BASE_SHA: 'other-base',
        SELECTIVE_BRANCH: 'renamed',
        SELECTIVE_TARGET_BRANCH: 'develop',
        SELECTIVE_GIT_REPO: 'acme/mirror'
      })
    ).toEqual({
      sha: 'head-sha',
      base_sha: 'other-base',
      branch: 'renamed',
      target_branch: 'develop',
      git_repo_full_name: 'acme/mirror'
    })
  })

  it('adds the environment only when given', () => {
    context.payload = {}
    const metadata = buildMetadata(prEnv, {
      framework: 'rspec',
      runtime_version: ''
    })
    expect(metadata.framework).toBe('rspec')
    expect(metadata).not.toHaveProperty('runtime_version')
  })
})
