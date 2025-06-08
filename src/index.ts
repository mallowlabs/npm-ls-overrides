#!/usr/bin/env node

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * npm-ls-overrides
 * A tool to list npm package dependencies in overrides.
 */

export interface PackageOverride {
  name: string;
  version: string;
  dependencyPath: string;
}

export interface NpmLsPackageInfo {
  version?: string;
  resolved?: string;
  overridden?: boolean;
  dependencies?: Record<string, NpmLsPackageInfo>;
}

export interface NpmLsOutput {
  name?: string;
  version?: string;
  dependencies?: Record<string, NpmLsPackageInfo>;
  overrides?: Record<string, string>;
}

export interface UnusedOverride {
  name: string;
  version: string;
}

export interface PackageJson {
  name?: string;
  version?: string;
  overrides?: Record<string, string>;
}

/**
 * Execute npm ls --all --json in the specified directory and return the output
 * @param targetDir - The directory to execute npm ls in
 * @returns The JSON output from npm ls command
 */
export function getNpmLsOutput(targetDir: string): NpmLsOutput {
  try {
    const absolutePath = path.resolve(targetDir);
    const command = 'npm ls --all --json';

    const output = execSync(command, {
      cwd: absolutePath,
      encoding: 'utf8',
      // Suppress stderr to avoid warnings being mixed with JSON output
      stdio: ['pipe', 'pipe', 'ignore']
    });

    return JSON.parse(output);
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      // npm ls might exit with non-zero status even when output is valid JSON
      // (e.g., when there are peer dependency warnings)
      try {
        return JSON.parse((error as any).stdout);
      } catch (parseError) {
        throw new Error(`Failed to parse npm ls output: ${parseError}`);
      }
    }
    throw new Error(`Failed to execute npm ls in directory ${targetDir}: ${error}`);
  }
}

/**
 * Recursively traverse dependencies and find packages that are overridden
 * @param dependencies - The dependencies object from npm ls output
 * @param overrides - Array to collect found overrides
 * @param parentPath - Array of parent packages with their version info
 */
export function findOverriddenPackages(
  dependencies: Record<string, NpmLsPackageInfo> | undefined,
  overrides: PackageOverride[] = [],
  parentPath: Array<{name: string, version: string}> = []
): PackageOverride[] {
  if (!dependencies || typeof dependencies !== 'object') {
    return overrides;
  }

  for (const [packageName, packageInfo] of Object.entries(dependencies)) {
    if (!packageInfo || typeof packageInfo !== 'object') {
      continue;
    }

    // Create current package info with version
    const currentPackage = {
      name: packageName,
      version: packageInfo.version || 'unknown'
    };

    const currentPath = [...parentPath, currentPackage];
    const currentPathString = currentPath.map(p => p.name).join(' > ');

    // Check if this package is overridden
    if (packageInfo.overridden === true) {
      // Create dependency path from overridden package to root (reverse order) with versions
      const dependencyPath = currentPath
        .map(p => `${p.name}@${p.version}`)
        .reverse()
        .join(' > ');

      const override: PackageOverride = {
        name: packageName,
        version: packageInfo.version || 'unknown',
        dependencyPath
      };

      console.log(`Found overridden package: ${packageName}@${override.version} at path: ${currentPathString}`);
      overrides.push(override);
    }

    // Recursively check nested dependencies
    if (packageInfo.dependencies) {
      findOverriddenPackages(packageInfo.dependencies, overrides, currentPath);
    }
  }

  return overrides;
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
 * Main function to analyze npm package overrides
 */
export function analyzeOverrides(targetDir: string = process.cwd()): PackageOverride[] {
  try {
    console.log(`Analyzing npm package overrides in: ${targetDir}`);
    const npmLsOutput = getNpmLsOutput(targetDir);

    // Find all overridden packages in the dependency tree
    return findOverriddenPackages(npmLsOutput.dependencies);
  } catch (error) {
    console.error('Error analyzing overrides:', error);
    return [];
  }
}

/**
 * Find unused overrides by comparing package.json overrides with actual overridden packages
 * @param targetDir - The directory to analyze
 * @param usedOverrides - Array of packages that are actually overridden
 * @returns Array of unused overrides
 */
export function findUnusedOverrides(targetDir: string, usedOverrides: PackageOverride[]): UnusedOverride[] {
  try {
    const packageJson = getPackageJson(targetDir);

    if (!packageJson.overrides) {
      return [];
    }

    const usedOverrideNames = new Set(usedOverrides.map(override => override.name));
    const unusedOverrides: UnusedOverride[] = [];

    for (const [packageName, version] of Object.entries(packageJson.overrides)) {
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
  const unusedOverrides = findUnusedOverrides(targetDir, overrides);

  let hasIssues = false;

  if (overrides.length === 0) {
    console.log('No overridden packages found.');
  } else {
    console.log(`Found ${overrides.length} overridden package(s):`);
    overrides.forEach((override, index) => {
      console.log(`${index + 1}. ${override.dependencyPath}`);
    });
  }

  if (unusedOverrides.length > 0) {
    console.log(`\n⚠️  Found ${unusedOverrides.length} unused override(s):`);
    unusedOverrides.forEach((override, index) => {
      console.log(`${index + 1}. ${override.name}@${override.version} (not used in dependency tree)`);
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
