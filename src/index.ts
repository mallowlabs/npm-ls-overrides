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
}

export interface TreeNode {
  name: string;
  rawSpec?: string;
  children: Map<string, TreeNode>;
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
    const overrides = parseExplainOutput(explainOutput, aliasMap);

    return overrides;
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
 * Format dependency paths as a unified tree structure with rawSpec information
 * @param pathsWithRawSpecs - Array of dependency paths with rawSpec information
 * @returns Formatted unified tree structure
 */
export function formatAsUnifiedTreeFromPathsWithRawSpecs(pathsWithRawSpecs: Array<Array<{ name: string; rawSpec?: string }>>): string {
  if (pathsWithRawSpecs.length === 0) {
    return '';
  }

  // Build tree structure from all paths with rawSpec information
  const root = buildTreeFromPathsWithRawSpecChain(pathsWithRawSpecs);

  // Format tree as string
  return formatTreeNode(root, '', true);
}

/**
 * Build tree structure from dependency paths with rawSpec chain information
 * @param pathsWithRawSpecs - Array of dependency paths with rawSpec information
 * @returns Root tree node
 */
export function buildTreeFromPathsWithRawSpecChain(pathsWithRawSpecs: Array<Array<{ name: string; rawSpec?: string }>>): TreeNode {
  if (pathsWithRawSpecs.length === 0) {
    throw new Error('No paths provided');
  }

  // Get the root package name from the first path
  const rootPackage = pathsWithRawSpecs[0][0]?.name || '';
  const root: TreeNode = {
    name: rootPackage,
    children: new Map()
  };

  // Add each path to the tree with rawSpec information
  for (const pathWithSpecs of pathsWithRawSpecs) {
    if (pathWithSpecs.length > 1) {
      // Skip the root package, start from dependents
      addPathToTreeWithRawSpecChain(root, pathWithSpecs.slice(1));
    }
  }

  return root;
}

/**
 * Format dependency paths as a unified tree structure with rawSpec information
 * @param dependencyPaths - Array of dependency path strings
 * @param rawSpecs - Array of rawSpec values corresponding to each dependency path
 * @returns Formatted unified tree structure
 */
export function formatAsUnifiedTree(dependencyPaths: string[], rawSpecs: string[] = []): string {
  if (dependencyPaths.length === 0) {
    return '';
  }

  // Build tree structure from all paths with rawSpec information
  const root = buildTreeFromPathsWithRawSpecs(dependencyPaths, rawSpecs);

  // Format tree as string
  return formatTreeNode(root, '', true);
}

/**
 * Build tree structure from dependency paths with rawSpec information
 * @param dependencyPaths - Array of dependency path strings
 * @param rawSpecs - Array of rawSpec values corresponding to each dependency path
 * @returns Root tree node
 */
export function buildTreeFromPathsWithRawSpecs(dependencyPaths: string[], rawSpecs: string[]): TreeNode {
  // Get the root package name from the first path
  const rootPackage = dependencyPaths[0]?.split(' > ')[0] || '';
  const root: TreeNode = {
    name: rootPackage,
    children: new Map()
  };

  // Add each path to the tree with rawSpec information
  for (let i = 0; i < dependencyPaths.length; i++) {
    const path = dependencyPaths[i];
    const rawSpec = rawSpecs[i] || '';
    const packages = path.split(' > ');
    if (packages.length > 1) {
      // Skip the root package, start from dependents
      addPathToTreeWithRawSpec(root, packages.slice(1), rawSpec);
    }
  }

  return root;
}

/**
 * Build tree structure from dependency paths
 * @param dependencyPaths - Array of dependency path strings
 * @returns Root tree node
 */
export function buildTreeFromPaths(dependencyPaths: string[]): TreeNode {
  return buildTreeFromPathsWithRawSpecs(dependencyPaths, []);
}

/**
 * Add a dependency path to the tree with rawSpec chain information
 * Each node shows the rawSpec of how its parent depends on it
 * @param node - Current tree node
 * @param pathSegments - Remaining path segments to add with rawSpec information
 */
function addPathToTreeWithRawSpecChain(node: TreeNode, pathSegments: Array<{ name: string; rawSpec?: string }>): void {
  if (pathSegments.length === 0) {
    return;
  }

  const [currentSegment, ...remainingSegments] = pathSegments;
  const currentPackage = currentSegment.name;

  if (!node.children.has(currentPackage)) {
    node.children.set(currentPackage, {
      name: currentPackage,
      rawSpec: currentSegment.rawSpec, // Set rawSpec from how parent depends on this node
      children: new Map()
    });
  } else {
    // Update existing node's rawSpec if it's not set yet
    const existingNode = node.children.get(currentPackage)!;
    if (!existingNode.rawSpec && currentSegment.rawSpec) {
      existingNode.rawSpec = currentSegment.rawSpec;
    }
  }

  const childNode = node.children.get(currentPackage)!;
  addPathToTreeWithRawSpecChain(childNode, remainingSegments);
}

/**
 * Add a dependency path to the tree with rawSpec information
 * @param node - Current tree node
 * @param pathSegments - Remaining path segments to add
 * @param rawSpec - The rawSpec value for this path
 */
function addPathToTreeWithRawSpec(node: TreeNode, pathSegments: string[], rawSpec: string): void {
  if (pathSegments.length === 0) {
    return;
  }

  const [currentPackage, ...remainingSegments] = pathSegments;

  if (!node.children.has(currentPackage)) {
    node.children.set(currentPackage, {
      name: currentPackage,
      rawSpec: remainingSegments.length === 0 ? rawSpec : undefined, // Only set rawSpec for leaf nodes
      children: new Map()
    });
  }

  const childNode = node.children.get(currentPackage)!;
  if (remainingSegments.length === 0 && rawSpec) {
    // Update rawSpec for leaf node if it's not already set
    if (!childNode.rawSpec) {
      childNode.rawSpec = rawSpec;
    }
  }
  addPathToTreeWithRawSpec(childNode, remainingSegments, rawSpec);
}

/**
 * Format tree node as string with proper indentation and rawSpec information
 * @param node - Tree node to format
 * @param prefix - Current indentation prefix
 * @param isRoot - Whether this is the root node
 * @returns Formatted string representation
 */
function formatTreeNode(node: TreeNode, prefix: string, isRoot: boolean): string {
  const lines: string[] = [];

  if (isRoot) {
    lines.push(node.name);
  }

  const children = Array.from(node.children.values());

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const currentPrefix = isRoot ? ' - ' : prefix + ' - ';
    const nextPrefix = isRoot ? '   ' : prefix + '   ';

    // Format child name with rawSpec if available
    const childDisplayName = child.rawSpec ? `${child.name} (${child.rawSpec})` : child.name;
    lines.push(currentPrefix + childDisplayName);

    if (child.children.size > 0) {
      const childOutput = formatTreeNode(child, nextPrefix, false);
      if (childOutput) {
        lines.push(childOutput);
      }
    }
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
      console.log(formatAsUnifiedTreeFromPathsWithRawSpecs(override.pathsWithRawSpecs));
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
