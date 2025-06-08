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
    // Get package.json to find defined overrides
    const packageJson = getPackageJson(targetDir);
    
    if (!packageJson.overrides) {
      return [];
    }

    // Get package names from overrides
    const packageNames = Object.keys(packageJson.overrides);
    
    // Use npm explain to get detailed information about these packages
    const explainOutput = getNpmExplainOutput(targetDir, packageNames);
    
    // Parse the output to find actually overridden packages
    return parseExplainOutput(explainOutput);
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
 * Format dependency path as a tree structure
 * @param dependencyPath - The dependency path string (e.g., "send@0.19.1 > honkit@6.0.3")
 * @returns Formatted tree structure
 */
function formatAsTree(dependencyPath: string): string {
  const packages = dependencyPath.split(' > ');

  if (packages.length <= 1) {
    return packages[0] || '';
  }

  const lines: string[] = [];

  // Add the root package (overridden package)
  lines.push(packages[0]);

  // Add dependent packages with tree structure
  for (let i = 1; i < packages.length; i++) {
    const indent = ' '.repeat((i - 1) * 2); // 2 spaces per level
    const isLast = i === packages.length - 1;
    const prefix = indent + (isLast ? ' - ' : ' ├ ');
    lines.push(prefix + packages[i]);
  }

  return lines.join('\n');
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
    overrides.forEach((override) => {
      console.log(formatAsTree(override.dependencyPath));
    });
  }

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

export interface NpmExplainDependent {
  type: string;
  name: string;
  spec: string;
  rawSpec?: string;
  overridden?: boolean;
  from?: {
    name?: string;
    version?: string;
    location: string;
    isWorkspace?: boolean;
    dependents?: NpmExplainDependent[];
  };
}

export interface NpmExplainPackage {
  name: string;
  version: string;
  location: string;
  isWorkspace: boolean;
  dependents: NpmExplainDependent[];
  dev: boolean;
  optional: boolean;
  devOptional: boolean;
  peer: boolean;
  bundled: boolean;
  overridden?: boolean;
}

export interface NpmExplainOutput extends Array<NpmExplainPackage> {}

/**
 * Execute npm explain for specified packages and return the output
 * @param targetDir - The directory to execute npm explain in
 * @param packageNames - Array of package names to explain
 * @returns The JSON output from npm explain command
 */
export function getNpmExplainOutput(targetDir: string, packageNames: string[]): NpmExplainOutput {
  if (packageNames.length === 0) {
    return [];
  }

  try {
    const absolutePath = path.resolve(targetDir);
    const command = `npm explain ${packageNames.join(' ')} --json`;

    const output = execSync(command, {
      cwd: absolutePath,
      encoding: 'utf8',
      // Suppress stderr to avoid warnings being mixed with JSON output
      stdio: ['pipe', 'pipe', 'ignore']
    });

    return JSON.parse(output);
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      // npm explain might exit with non-zero status for non-existent packages
      // but still provide valid JSON output for existing ones
      try {
        const stdout = (error as any).stdout;
        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout);
          // Check if it's an error response
          if (parsed && typeof parsed === 'object' && 'error' in parsed) {
            return [];
          }
          // Return parsed result if it's a valid array
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
      } catch (parseError) {
        // If parsing fails, return empty array
      }
    }
    // Return empty array instead of throwing error for non-existent packages
    return [];
  }
}

/**
 * Parse npm explain output to find overridden packages
 * @param explainOutput - The output from npm explain command
 * @returns Array of package overrides
 */
export function parseExplainOutput(explainOutput: NpmExplainOutput): PackageOverride[] {
  const overrides: PackageOverride[] = [];

  for (const packageInfo of explainOutput) {
    if (packageInfo.overridden === true) {
      // Build dependency path from the dependents information
      const dependencyPath = buildDependencyPath(packageInfo);
      
      const override: PackageOverride = {
        name: packageInfo.name,
        version: packageInfo.version,
        dependencyPath
      };

      overrides.push(override);
    }
  }

  return overrides;
}

/**
 * Build dependency path from npm explain package info
 * @param packageInfo - Package information from npm explain
 * @returns Dependency path string
 */
function buildDependencyPath(packageInfo: NpmExplainPackage): string {
  const path: string[] = [];
  
  // Add the overridden package first
  path.push(`${packageInfo.name}@${packageInfo.version}`);
  
  // Find the dependency chain through dependents
  if (packageInfo.dependents && packageInfo.dependents.length > 0) {
    const dependent = packageInfo.dependents[0]; // Take the first dependent
    if (dependent.from && dependent.from.name) {
      path.push(`${dependent.from.name}@${dependent.from.version || 'unknown'}`);
    }
  }
  
  return path.join(' > ');
}
