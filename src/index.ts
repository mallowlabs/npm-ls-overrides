#!/usr/bin/env node

import { execSync } from 'child_process';
import * as path from 'path';

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
 * @param parentPath - Current path in the dependency tree (from root to current)
 */
export function findOverriddenPackages(dependencies: Record<string, NpmLsPackageInfo> | undefined, overrides: PackageOverride[] = [], parentPath: string = ''): PackageOverride[] {
  if (!dependencies || typeof dependencies !== 'object') {
    return overrides;
  }

  for (const [packageName, packageInfo] of Object.entries(dependencies)) {
    if (!packageInfo || typeof packageInfo !== 'object') {
      continue;
    }

    const currentPath = parentPath ? `${parentPath} > ${packageName}` : packageName;

    // Check if this package is overridden
    if (packageInfo.overridden === true) {
      // Create dependency path from overridden package to root (reverse order)
      const pathParts = currentPath.split(' > ');

      // Add version to the overridden package name (first in reversed path)
      const packageWithVersion = `${packageName}@${packageInfo.version || 'unknown'}`;
      pathParts[pathParts.length - 1] = packageWithVersion;

      const dependencyPath = pathParts.reverse().join(' > ');

      const override: PackageOverride = {
        name: packageName,
        version: packageInfo.version || 'unknown',
        dependencyPath
      };

      console.log(`Found overridden package: ${packageName}@${override.version} at path: ${currentPath}`);
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
    overrides.forEach((override, index) => {
      console.log(`${index + 1}. ${override.dependencyPath}`);
    });
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
