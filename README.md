# Setup Selective Action

[![GitHub Super-Linter](https://github.com/selectiveci/setup-selective/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/selectiveci/setup-selective/actions/workflows/ci.yml/badge.svg)
[![Check dist](https://github.com/selectiveci/setup-selective/actions/workflows/check-dist.yml/badge.svg)](https://github.com/selectiveci/setup-selective/actions/workflows/check-dist.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Sets up [Selective](https://selective.ci) in a GitHub Actions workflow. Its
`plan` action gets test selection ready before your test runners start, and
tells you how many runners the change needs.

## Run your tests through Selective

Add the action to each test job, before the step that runs your tests:

```yaml
strategy:
  fail-fast: false
  matrix:
    runner: [0, 1, 2, 3]

steps:
  - uses: actions/checkout@v7

  - name: Setup Selective
    uses: selectiveci/setup-selective@v1
    with:
      api-key: ${{ secrets.SELECTIVE_API_KEY }}
      runner-id: ${{ matrix.runner }}

  - run: bundle exec selective rspec
```

## Start only the runners a change needs

When Selective selects tests for a pull request, a small change may need one
runner rather than twenty. Add a `plan` job that runs alongside your build and
gives your test job its matrix:

```yaml
jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.plan.outputs.matrix }}
    steps:
      - id: plan
        uses: selectiveci/setup-selective/plan@v1
        with:
          api-key: ${{ secrets.SELECTIVE_API_KEY }}
          max-runners: 20

  tests:
    needs: [plan]
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        runner: ${{ fromJSON(needs.plan.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v7
      - uses: selectiveci/setup-selective@v1
        with:
          api-key: ${{ secrets.SELECTIVE_API_KEY }}
          runner-id: ${{ matrix.runner }}
      - run: bundle exec selective rspec
```

- **What it does.** The plan starts preparing selection for the commit, waits
  for the decision, and outputs a `matrix` of runner indices. Each test runner
  still uses `setup-selective` as before.
- **The count it gives.** Enough runners for about `target-seconds` (default
  120) of selected tests each, between `min-runners` and `max-runners`.
- **Builds that run everything.** A build that doesn't select gets
  `max-runners`: one that runs every test, one where selection is off for the
  suite, or one where Selective can't answer within `timeout-seconds`.
  Selective never makes CI fail.
- **The wait runs alongside your build.** If your test jobs also wait for a
  build job, put that in `needs` too. The plan then only adds time when it
  takes longer than the build.
- **No extra jobs.** Preparation starts in your workflow, so it happens only
  for builds that will run tests.
- **Pull requests from forks.** They get no secrets, so without an API key
  the plan is `max-runners` rather than a failure.

### Required status checks

A planned matrix has a different number of jobs on each build, so don't
require the individual test jobs (`tests (0)`, `tests (1)`, …) in branch
protection. Add one job that passes when they all did, and require that:

```yaml
  tests-passed:
    name: Tests passed
    needs: [tests]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - run: test "${{ needs.tests.result }}" = success
```

### Suites that run on several language versions

Selective records a test map for each environment. If one suite runs on
several Ruby versions, say which one this workflow uses, so the preparation
matches the run:

```yaml
- uses: ruby/setup-ruby@v1
  with:
    ruby-version: '4.0'
- id: ruby
  run: ruby -e 'puts "version=#{RUBY_VERSION}"' >> "$GITHUB_OUTPUT"
- id: plan
  uses: selectiveci/setup-selective/plan@v1
  with:
    api-key: ${{ secrets.SELECTIVE_API_KEY }}
    max-runners: 20
    language: ruby
    framework: rspec
    runtime-version: ${{ steps.ruby.outputs.version }}
```

## Inputs

`selectiveci/setup-selective`, on each test runner:

| Input | Default | Description |
| --- | --- | --- |
| `api-key` | `SELECTIVE_API_KEY` | The suite's API key |
| `runner-id` | | This runner's index in the matrix |

`selectiveci/setup-selective/plan`, once per build:

| Input | Default | Description |
| --- | --- | --- |
| `api-key` | `SELECTIVE_API_KEY` | The suite's API key |
| `max-runners` | (required) | The most runners; the plan when every test runs |
| `min-runners` | `1` | The fewest runners to plan |
| `target-seconds` | `120` | Seconds of selected tests per runner |
| `timeout-seconds` | `90` | How long to wait before using `max-runners` |
| `host` | `SELECTIVE_HOST` | Selective host, else `app.selective.ci` |
| `language` | | For suites with several environments |
| `framework` | | For suites with several environments |
| `runtime-version` | | For suites with several environments |

## Plan outputs

| Output | Description |
| --- | --- |
| `runners` | How many runners to start |
| `matrix` | Runner indices, `[0, 1, …]`, for `strategy.matrix` |
| `status` | `selected`, `full` or `fallback` |

`status` is `selected` when the plan is sized to the selection, `full` when
every test runs, and `fallback` when Selective didn't answer and the plan is
`max-runners`.
