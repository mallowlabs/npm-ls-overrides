import { execSync } from 'child_process';
import * as path from 'path';
import { PackageOverride, PackageJson } from './index';

interface PnpmWhyPackage {
  from: string;
  version: string;
  resolved?: string;
  path?: string;
  dependencies?: Record<string, PnpmWhyPackage>;
  devDependencies?: Record<string, PnpmWhyPackage>;
  optionalDependencies?: Record<string, PnpmWhyPackage>;
}

interface PnpmWhyProject {
  name: string;
  version: string;
  path: string;
  dependencies?: Record<string, PnpmWhyPackage>;
  devDependencies?: Record<string, PnpmWhyPackage>;
  optionalDependencies?: Record<string, PnpmWhyPackage>;
}

/**
 * Analyze pnpm package overrides
 * @param targetDir - The directory containing package.json
 * @param packageJson - The parsed package.json content
 * @returns Array of package overrides
 */
export function analyzePnpmOverrides(targetDir: string, packageJson: PackageJson): PackageOverride[] {
  const combinedOverrides = {
    ...packageJson.overrides,
    ...packageJson.pnpm?.overrides,
  };

  const packageNames = Object.keys(combinedOverrides);
  if (packageNames.length === 0) {
    return [];
  }

  try {
    const absolutePath = path.resolve(targetDir);
    // pnpm why <pkg> --json
    const command = `pnpm why ${packageNames.join(' ')} --json`;

    const output = execSync(command, {
      cwd: absolutePath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    const projects: PnpmWhyProject[] = JSON.parse(output);
    const overrides: PackageOverride[] = [];

    for (const packageName of packageNames) {
      const targetVersion = combinedOverrides[packageName as keyof typeof combinedOverrides];
      const pathsWithRawSpecs: Array<Array<{ name: string; rawSpec?: string }>> = [];

      for (const project of projects) {
        const projectRoot = `${project.name}@${project.version}`;
        
        // Traverse the dependency tree to find the package and its paths
        findPackagePaths(
          project.dependencies || {},
          packageName,
          [{ name: projectRoot }],
          pathsWithRawSpecs
        );
        findPackagePaths(
          project.devDependencies || {},
          packageName,
          [{ name: projectRoot }],
          pathsWithRawSpecs
        );
      }

      if (pathsWithRawSpecs.length > 0) {
        // In pnpm, we'll assume it's overridden if it appears in the tree
        // and is listed in the overrides field of package.json.
        // We take the version of the first occurrence found.
        const actualVersion = findActualVersion(projects, packageName) || targetVersion;

        overrides.push({
          name: packageName,
          version: actualVersion,
          dependencyPaths: pathsWithRawSpecs.map(p => p.map(s => s.name).join(' > ')),
          pathsWithRawSpecs: pathsWithRawSpecs
        });
      }
    }

    return overrides;
  } catch (error) {
    // console.error('Error analyzing pnpm overrides:', error);
    return [];
  }
}

/**
 * Recursively find all paths to a package in pnpm's dependency tree
 */
function findPackagePaths(
  dependencies: Record<string, PnpmWhyPackage>,
  targetName: string,
  currentPath: Array<{ name: string; rawSpec?: string }>,
  results: Array<Array<{ name: string; rawSpec?: string }>>
): void {
  for (const [name, pkg] of Object.entries(dependencies)) {
    const pkgNameWithVersion = `${name}@${pkg.version}`;
    const newSegment = { name: pkgNameWithVersion, rawSpec: pkg.from !== name ? pkg.from : undefined };
    const newPath = [...currentPath, newSegment];

    if (name === targetName) {
      results.push(newPath);
    }

    if (pkg.dependencies) {
      findPackagePaths(pkg.dependencies, targetName, newPath, results);
    }
    if (pkg.devDependencies) {
      findPackagePaths(pkg.devDependencies, targetName, newPath, results);
    }
    if (pkg.optionalDependencies) {
      findPackagePaths(pkg.optionalDependencies, targetName, newPath, results);
    }
  }
}

/**
 * Find the actual installed version of a package from pnpm why output
 */
function findActualVersion(projects: PnpmWhyProject[], targetName: string): string | undefined {
  const findInDeps = (deps: Record<string, PnpmWhyPackage>): string | undefined => {
    for (const [name, pkg] of Object.entries(deps)) {
      if (name === targetName) return pkg.version;
      const nested = pkg.dependencies ? findInDeps(pkg.dependencies) : undefined;
      if (nested) return nested;
    }
    return undefined;
  };

  for (const project of projects) {
    const version = findInDeps(project.dependencies || {}) || 
                    findInDeps(project.devDependencies || {}) ||
                    findInDeps(project.optionalDependencies || {});
    if (version) return version;
  }
  return undefined;
}
