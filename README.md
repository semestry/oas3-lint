# oas3-lint
GitHub Action for linting OpenAPI Specification 3 files using [Spectral](https://github.com/stoplightio/spectral).

## Usage
```yaml
jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - uses: eveoh/oas3-lint@v1
        with:
          spec: path/to/spec.yaml
          token: ${{ secrets.GITHUB_TOKEN }}
```

### Options

#### spec (required)
The path to the specification file (OpenAPI Specification 3, YAML) that should be linted.

*Example:*
```yaml
with:
  spec: path/to/spec.yaml
```

#### token (required)
The GitHub token that is used to create the Check Run using the GitHub Checks API.
Should be set to the `GITHUB_TOKEN` secret that is automatically created by the GitHub Actions runner.
          
*Example:*
```yaml
with:
  token: ${{ secrets.GITHUB_TOKEN }}
```

#### ruleset
Path to the ruleset file.

*Example:*
```yaml
with:
  ruleset: path/to/.spectral.yaml
```
