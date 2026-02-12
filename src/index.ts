#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { analyzeNpmOverrides } from './npm';
import { analyzePnpmOverrides } from './pnpm';
import { formatAsUnifiedTreeFromPathsWithRawSpecs } from './tree';

/**
 * npm-ls-overrides
 * A tool to list npm package dependencies in overrides.
 */

export interface PackageOverride {
  name: string;
  version: string;
  dependencyPaths: string[];
  pathsWithRawSpecs: Array<Array<{ name: string; rawSpec?: string }>>; // Each path as array of segments with rawSpec
  aliasedFrom?: string; // Original package name if this is an alias (e.g., "rollup" for "@rollup/wasm-node")
}

export interface UnusedOverride {
  name: string;
  version: string;
}

export interface PackageJson {
  name?: string;
  version?: string;
  overrides?: Record<string, string>;
  pnpm?: {
    overrides?: Record<string, string>;
  };
}

/**
 * Read and parse package.json from the specified directory
 * @param targetDir - The directory containing package.json
 * @returns The parsed package.json content
 */
export function getPackageJson(targetDir: string): PackageJson {
  try {
    const absolutePath = path.resolve(targetDir);
    const packageJsonPath = path.join(absolutePath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`package.json not found in ${targetDir}`);
    }

    const content = fs.readFileSync(packageJsonPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read package.json from ${targetDir}: ${error}`);
  }
}

/**
 * Main function to analyze package overrides
 */
export function analyzeOverrides(targetDir: string = process.cwd()): PackageOverride[] {
  try {
    // Get package.json to find defined overrides
    const packageJson = getPackageJson(targetDir);

    // Detect package manager
    const absolutePath = path.resolve(targetDir);
    if (fs.existsSync(path.join(absolutePath, 'pnpm-lock.yaml'))) {
      return analyzePnpmOverrides(targetDir, packageJson);
    }

    // Default to npm
    return analyzeNpmOverrides(targetDir, packageJson);
  } catch (error) {
    console.error('Error analyzing overrides:', error);
    return [];
  }
}

/**
 * Find unused overrides by comparing package.json overrides with actual overridden packages
 * @param targetDir - The directory to analyze
 * @param usedOverrides - Array of packages that are actually overridden
 * @param packageJson - Optional pre-read package.json content
 * @returns Array of unused overrides
 */
export function findUnusedOverrides(targetDir: string, usedOverrides: PackageOverride[], packageJson?: PackageJson): UnusedOverride[] {
  try {
    const pkgJson = packageJson || getPackageJson(targetDir);

    const combinedOverrides = {
      ...pkgJson.overrides,
      ...pkgJson.pnpm?.overrides,
    };

    if (Object.keys(combinedOverrides).length === 0) {
      return [];
    }

    const usedOverrideNames = new Set(usedOverrides.map(override => override.name));
    const unusedOverrides: UnusedOverride[] = [];

    for (const [packageName, version] of Object.entries(combinedOverrides)) {
      if (!usedOverrideNames.has(packageName)) {
        unusedOverrides.push({
          name: packageName,
          version: version
        });
      }
    }

    return unusedOverrides;
  } catch (error) {
    console.error('Error finding unused overrides:', error);
    return [];
  }
}

/**
 * CLI entry point
 */
function main(): void {
  // Get target directory from command line arguments or use current directory
  const targetDir = process.argv[2] || process.cwd();

  const overrides = analyzeOverrides(targetDir);
  if (overrides.length === 0) {
    console.log('No overridden packages found.');
  } else {
    console.log(`Found ${overrides.length} overridden package(s):`);
    overrides.forEach((override) => {
      console.log(formatAsUnifiedTreeFromPathsWithRawSpecs(override.pathsWithRawSpecs));
    });
  }

  let hasIssues = false;
  const unusedOverrides = findUnusedOverrides(targetDir, overrides);
  if (unusedOverrides.length > 0) {
    console.log(`\n⚠️  Found ${unusedOverrides.length} unused override(s):`);
    unusedOverrides.forEach((override) => {
      console.log(`${override.name}@${override.version} (not used in dependency tree)`);
    });
    hasIssues = true;
  }

  if (hasIssues) {
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
