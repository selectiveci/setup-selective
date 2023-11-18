# Setup Selective Action

[![GitHub Super-Linter](https://github.com/selectiveci/setup-selective/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/selectiveci/setup-selective/actions/workflows/ci.yml/badge.svg)
[![Check dist](https://github.com/selectiveci/setup-selective/actions/workflows/check-dist.yml/badge.svg)](https://github.com/selectiveci/setup-selective/actions/workflows/check-dist.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This action is for setting up need environment variables for [Selective](https://selective.ci)

## Usage

To include the action in a workflow in another repository, you can use the
`uses` syntax with the `@` symbol to reference a specific branch, tag, or commit
hash.

Example GitHub Actions config with four runners:

```yaml
strategy:
  fail-fast: false
  matrix:
    ci_node_total: [4]
    ci_node_index: [0, 1, 2, 3]

steps:
  - name: Checkout
    id: checkout
    uses: actions/checkout@v4

  - name: Setup Selective
    uses: selectiveci/setup-selective@v1
    with:
      api-key: ${{ secrets.SELECTIVE_API_KEY }}
      runner-id: ${{ matrix.ci_node_index }}
```
