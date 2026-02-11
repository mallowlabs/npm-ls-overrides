import { execSync } from 'child_process';
import * as path from 'path';
import { PackageOverride, PackageJson } from './index';

/**
 * Analyze npm package overrides
 * @param targetDir - The directory containing package.json
 * @param packageJson - The parsed package.json content
 * @returns Array of package overrides
 */
export function analyzeNpmOverrides(targetDir: string, packageJson: PackageJson): PackageOverride[] {
  if (!packageJson.overrides) {
    return [];
  }

  // Get package names from overrides, handling npm: alias syntax
  const packageNames = Object.keys(packageJson.overrides);
  const explainPackageNames: string[] = [];
  const aliasMap = new Map<string, string>(); // Map alias name to actual package name

  for (const packageName of packageNames) {
    const overrideValue = packageJson.overrides[packageName];
    if (overrideValue.startsWith('npm:')) {
      // Extract actual package name from npm:@scope/package@version syntax
      // Example: "npm:@rollup/wasm-node@^4.22.5" -> "@rollup/wasm-node"
      const npmPart = overrideValue.substring(4); // Remove "npm:"
      const atIndex = npmPart.lastIndexOf('@');
      const actualPackageName = atIndex > 0 ? npmPart.substring(0, atIndex) : npmPart;
      explainPackageNames.push(actualPackageName);
      // For npm aliases, map alias name to actual package name
      aliasMap.set(packageName, actualPackageName); // rollup -> @rollup/wasm-node
    } else {
      explainPackageNames.push(packageName);
    }
  }

  // Use npm explain to get detailed information about these packages
  const explainOutput = getNpmExplainOutput(targetDir, explainPackageNames);

  // Parse the output to find actually overridden packages
  return parseExplainOutput(explainOutput, aliasMap);
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
 * @param aliasMap - Map of alias names to actual package names
 * @returns Array of package overrides
 */
export function parseExplainOutput(explainOutput: NpmExplainOutput, aliasMap?: Map<string, string>): PackageOverride[] {
  const overrides: PackageOverride[] = [];

  for (const packageInfo of explainOutput) {
    if (packageInfo.overridden === true) {
      // Check if this package is aliased (npm explain returns alias name in packageInfo.name)
      const actualPackageName = aliasMap?.get(packageInfo.name);

      // Build all dependency paths from the dependents information
      const { dependencyPaths, pathsWithRawSpecs } = buildAllDependencyPathsWithRawSpecs(
        packageInfo,
        actualPackageName ? { aliasName: packageInfo.name, actualName: actualPackageName } : undefined
      );

      const override: PackageOverride = {
        name: packageInfo.name,
        version: packageInfo.version,
        dependencyPaths,
        pathsWithRawSpecs,
        aliasedFrom: actualPackageName ? packageInfo.name : undefined
      };

      overrides.push(override);
    }
  }

  return overrides;
}

/**
 * Build all dependency paths with rawSpec information from npm explain package info
 * @param packageInfo - Package information from npm explain
 * @param aliasInfo - Alias information if this is an npm alias
 * @returns Object containing dependency paths and paths with rawSpec information
 */
function buildAllDependencyPathsWithRawSpecs(packageInfo: NpmExplainPackage, aliasInfo?: { aliasName: string; actualName: string }): { dependencyPaths: string[], pathsWithRawSpecs: Array<Array<{ name: string; rawSpec?: string }>> } {
  const paths: string[] = [];
  const pathsWithRawSpecs: Array<Array<{ name: string; rawSpec?: string }>> = [];

  // Add the overridden package as the root - use alias format if aliased
  const rootPackage = aliasInfo
    ? `${aliasInfo.aliasName}>${aliasInfo.actualName}@${packageInfo.version}`
    : `${packageInfo.name}@${packageInfo.version}`;

  if (!packageInfo.dependents || packageInfo.dependents.length === 0) {
    // No dependents, return just the package itself
    return {
      dependencyPaths: [rootPackage],
      pathsWithRawSpecs: [[{ name: rootPackage }]] // Root has no rawSpec
    };
  }

  // Recursively build paths for each dependent
  for (const dependent of packageInfo.dependents) {
    const subPaths = buildDependentPathsWithRawSpecChain(dependent, []);
    for (const pathWithSpecs of subPaths) {
      // Create the full path: overridden package > dependent path
      const fullPathWithSpecs = [{ name: rootPackage }, ...pathWithSpecs];
      const fullPath = fullPathWithSpecs.map(segment => segment.name).join(' > ');
      paths.push(fullPath);
      pathsWithRawSpecs.push(fullPathWithSpecs);
    }
  }

  return { dependencyPaths: paths, pathsWithRawSpecs };
}

/**
 * Recursively build dependency paths with rawSpec chain from dependents
 * @param dependent - The dependent information
 * @param currentPath - Current path being built with rawSpec information
 * @returns Array of dependency paths with rawSpec information
 */
function buildDependentPathsWithRawSpecChain(dependent: NpmExplainDependent, currentPath: Array<{ name: string; rawSpec?: string }>): Array<Array<{ name: string; rawSpec?: string }>> {
  const results: Array<Array<{ name: string; rawSpec?: string }>> = [];

  if (dependent.from && dependent.from.name) {
    const packageName = `${dependent.from.name}@${dependent.from.version || 'unknown'}`;
    // The rawSpec for this node is the spec of how the parent depends on this package
    const rawSpec = dependent.rawSpec || dependent.spec || '';
    const newSegment = { name: packageName, rawSpec: rawSpec || undefined };
    const newPath = [...currentPath, newSegment];

    if (dependent.from.dependents && dependent.from.dependents.length > 0) {
      // Continue recursively for nested dependents
      for (const nestedDependent of dependent.from.dependents) {
        const nestedResults = buildDependentPathsWithRawSpecChain(nestedDependent, newPath);
        results.push(...nestedResults);
      }
    } else {
      // This is a leaf node, add the path
      results.push(newPath);
    }
  } else {
    // No from info, this might be a root dependency
    if (currentPath.length > 0) {
      results.push(currentPath);
    }
  }

  return results;
}
