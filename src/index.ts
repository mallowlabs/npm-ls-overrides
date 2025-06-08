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
  dependencies?: string[];
}

/**
 * Execute npm ls --all --json in the specified directory and return the output
 * @param targetDir - The directory to execute npm ls in
 * @returns The JSON output from npm ls command
 */
export function getNpmLsOutput(targetDir: string): any {
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
 * Main function to analyze npm package overrides
 */
export function analyzeOverrides(targetDir: string = process.cwd()): PackageOverride[] {
  try {
    console.log(`Analyzing npm package overrides in: ${targetDir}`);
    const npmLsOutput = getNpmLsOutput(targetDir);

    // TODO: Implement override analysis logic using npmLsOutput
    console.log('npm ls output structure:', {
      name: npmLsOutput.name,
      version: npmLsOutput.version,
      hasOverrides: !!npmLsOutput.overrides,
      dependenciesCount: npmLsOutput.dependencies ? Object.keys(npmLsOutput.dependencies).length : 0
    });

    return [];
  } catch (error) {
    console.error('Error analyzing overrides:', error);
    return [];
  }
}

/**
 * CLI entry point
 */
function main(): void {
  const overrides = analyzeOverrides();
  console.log('Found overrides:', overrides);
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
