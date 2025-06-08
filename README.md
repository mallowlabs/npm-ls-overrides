# npm-ls-overrides

A tool to list npm package dependencies in overrides.

## Usage

```bash
$ npx npm-ls-overrides
```

## Example

```json:package.json
  "dependencies": {
    "honkit": "6.0.3"
  },
  "overrides": {
    "send": "0.19.1"
  }
```

```bash
$ npx npm-ls-overrides
send@0.19.1 (0.17.2)
└─honkit@6.0.3
```

## How it works

`npm-ls-overrides` parses the `npm ls --all --json` output.
It then filters the output to include only the packages that are overridden in the `overrides` field of `package.json`.
