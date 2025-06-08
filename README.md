# npm-ls-overrides

A tool to analyze npm package dependencies and detect both used and unused overrides.

## Features

- **Detect used overrides**: Lists packages that are actually overridden in the dependency tree
- **Detect unused overrides**: Identifies overrides defined in `package.json` but not used in the dependency tree  
- **Tree-style output**: Displays dependency relationships in an easy-to-read tree format
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
Found 1 overridden package(s):
send@0.19.1
 - honkit@6.0.3
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
Found 1 overridden package(s):
send@0.19.1
 - honkit@6.0.3

⚠️  Found 1 unused override(s):
trim@0.0.3 (not used in dependency tree)
$ echo $?
1
```

## How it works

1. `npm-ls-overrides` reads `package.json` to identify defined overrides
2. It executes `npm explain <package> --json` for each override to get detailed dependency information
3. It parses the output to find packages marked with `overridden: true`
4. It builds a unified tree structure from all dependency paths to avoid duplicate nodes
5. It compares used overrides with defined overrides to identify unused ones
6. Returns exit code 1 if any unused overrides are found
