# npm-ls-overrides

A tool to analyze npm package dependencies and detect both used and unused overrides.

## Features

- **Detect used overrides**: Lists packages that are actually overridden in the dependency tree
- **Detect unused overrides**: Identifies overrides defined in `package.json` but not used in the dependency tree
- **Exit code handling**: Returns exit code 1 when unused overrides are found

## Usage

```bash
$ npx npm-ls-overrides [directory]
```

If no directory is specified, the current directory is used.

## Example

### Used Override

```json:package.json
{
  "dependencies": {
    "honkit": "6.0.3"
  },
  "overrides": {
    "send": "0.19.1"
  }
}
```

```bash
$ npx npm-ls-overrides
Analyzing npm package overrides in: .
Found overridden package: send@0.19.1 at path: honkit > send
Found 1 overridden package(s):
1. send@0.19.1 > honkit@6.0.3
```

### Unused Override

```json:package.json
{
  "dependencies": {
    "honkit": "6.0.3"
  },
  "overrides": {
    "send": "0.19.1",
    "trim": "0.0.3"
  }
}
```

```bash
$ npx npm-ls-overrides
Analyzing npm package overrides in: .
Found overridden package: send@0.19.1 at path: honkit > send
Found 1 overridden package(s):
1. send@0.19.1 > honkit@6.0.3

⚠️  Found 1 unused override(s):
1. trim@0.0.3 (not used in dependency tree)
$ echo $?
1
```

## How it works

1. `npm-ls-overrides` executes `npm ls --all --json` to get the complete dependency tree
2. It parses the output to find packages marked with `overridden: true`
3. It reads `package.json` to get the defined overrides
4. It compares the two lists to identify unused overrides
5. Returns exit code 1 if any unused overrides are found
