import * as github from '@actions/github'

export type Metadata = Record<string, string>

const ZERO_SHA = '0000000000000000000000000000000000000000'

// Mirrors the GitHub Actions branch of selective-ruby-core's build_env.sh, so a
// warm-up and plan describe the same change the test runners will report.
export function buildMetadata(
  env: Record<string, string | undefined> = process.env,
  extra: Metadata = {}
): Metadata {
  const payload = github.context.payload as {
    pull_request?: { base?: { sha?: string } }
    before?: string
  }
  const eventBase = payload.pull_request?.base?.sha ?? payload.before ?? ''
  const baseSha = eventBase === ZERO_SHA ? '' : eventBase

  const metadata: Metadata = {
    sha: env.SELECTIVE_SHA || env.GITHUB_SHA || '',
    base_sha: env.SELECTIVE_BASE_SHA || baseSha,
    branch:
      env.SELECTIVE_BRANCH || env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || '',
    target_branch: env.SELECTIVE_TARGET_BRANCH || env.GITHUB_BASE_REF || '',
    git_repo_full_name: env.SELECTIVE_GIT_REPO || env.GITHUB_REPOSITORY || ''
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value) metadata[key] = value
  }
  return metadata
}
