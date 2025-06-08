# npm-ls-overrides

A tool to analyze npm package dependencies and detect both used and unused overrides.

## Features

- **Detect used overrides**: Lists packages that are actually overridden in the dependency tree
- **Detect unused overrides**: Identifies overrides defined in `package.json` but not used in the dependency tree  
- **Show original version specs**: Displays the original version specification (rawSpec) that was overridden, helping identify potential downgrades
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
 - honkit@6.0.3 (^0.17.2)
```

The `(^0.17.2)` shows the original version specification that was overridden. This helps you verify whether you're overriding to an older version that might introduce security or compatibility issues.

### npm Alias Override

When using npm aliases, the tool displays them in the format `alias>actual-package@version`:

```json:package.json
{
  "dependencies": {
    "vite": "^6.3.5"
  },
  "overrides": {
    "rollup": "npm:@rollup/wasm-node@^4.22.5"
  }
}
```

```bash
$ npx npm-ls-overrides
Found 1 overridden package(s):
rollup>@rollup/wasm-node@4.42.0
 - vite@6.3.5 (^4.34.9)
```

The `rollup>@rollup/wasm-node@4.42.0` format clearly shows that `rollup` is aliased to `@rollup/wasm-node` package.

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
 - honkit@6.0.3 (^0.17.2)

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
