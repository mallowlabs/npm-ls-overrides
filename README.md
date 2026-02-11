# npm-ls-overrides

A tool to analyze package dependencies and detect both used and unused overrides for **npm** and **pnpm**.

## Features

- **Multi-package manager support**: Automatically detects whether to use `npm` or `pnpm` based on lock files.
- **Detect used overrides**: Lists packages that are actually overridden in the dependency tree
- **Detect unused overrides**: Identifies overrides defined in `package.json` but not used in the dependency tree  
- **Show original version specs**: Displays the original version specification (rawSpec) that was overridden, helping identify potential downgrades
- **Tree-style output**: Displays dependency relationships in an easy-to-read tree format
- **Exit code handling**: Returns exit code 1 when unused overrides are found

## Usage

```bash
$ npx github:mallowlabs/npm-ls-overrides [directory]
```

If no directory is specified, the current directory is used.

### Package Manager Detection

The tool automatically detects the package manager by looking for lock files in the target directory:
- If `pnpm-lock.yaml` exists, it uses **pnpm**.
- Otherwise, it defaults to **npm**.

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

### npm Alias Override (npm only)

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

1. `npm-ls-overrides` reads `package.json` to identify defined overrides.
2. It detects the package manager by checking for `pnpm-lock.yaml`.
3. It executes the appropriate command to get detailed dependency information:
   - For **npm**: `npm explain <package> --json`
   - For **pnpm**: `pnpm why <package> --json`
4. It parses the output to build dependency paths and identify overridden packages.
5. It builds a unified tree structure from all dependency paths to avoid duplicate nodes.
6. It compares used overrides with defined overrides in `package.json` to identify unused ones.
7. Returns exit code 1 if any unused overrides are found.
