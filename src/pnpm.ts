import { execSync } from 'child_process';
import * as path from 'path';
import { PackageOverride, PackageJson } from './index';

interface PnpmWhyDependent {
  name: string;
  version: string;
  depField?: string; // e.g., "dependencies", "devDependencies"
  dependents?: PnpmWhyDependent[]; // For reverse tree
}

interface PnpmWhyPackageOutput {
  name: string;
  version: string;
  path: string;
  dependents?: PnpmWhyDependent[]; // The reverse dependency tree
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
    const command = `npx pnpm why ${packageNames.join(' ')} --json`;

    const output = execSync(command, {
      cwd: absolutePath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    const pnpmWhyOutputs: PnpmWhyPackageOutput[] = JSON.parse(output);

    // Check if the output format matches the expected new pnpm why format (reverse tree)
    // If it's an empty array or the first element doesn't have 'dependents' field,
    // it likely indicates an older pnpm version or unexpected output.
    if (!Array.isArray(pnpmWhyOutputs) || pnpmWhyOutputs.length === 0 || !pnpmWhyOutputs[0].dependents) {
      console.warn(
        `[npm-ls-overrides] Warning: The output from 'pnpm why' command does not match the expected format. ` +
        `This might be due to an older pnpm version. ` +
        `Please consider upgrading pnpm to at least 10.30.0 for full functionality.`
      );
      return [];
    }
    const overrides: PackageOverride[] = [];

    for (const packageName of packageNames) {
      const targetVersion = combinedOverrides[packageName as keyof typeof combinedOverrides];
      const pathsWithRawSpecs: Array<Array<{ name: string; rawSpec?: string }>> = [];

      for (const pnpmWhyOutput of pnpmWhyOutputs) {
        if (pnpmWhyOutput.name === packageName) {
          // Reconstruct paths from the reverse dependency tree
          // The root of the reverse tree is the package itself, its dependents are its parents
          const reversePaths = getReverseDependencyPaths(pnpmWhyOutput.dependents || [], [{ name: `${pnpmWhyOutput.name}@${pnpmWhyOutput.version}` }]);
          pathsWithRawSpecs.push(...reversePaths);
        }
      }

      if (pathsWithRawSpecs.length > 0) {
        // In pnpm, we'll assume it's overridden if it appears in the tree
        // and is listed in the overrides field of package.json.
        // We take the version of the first occurrence found.
        const actualVersion = pnpmWhyOutputs.find(pkg => pkg.name === packageName)?.version || targetVersion;

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
 * Recursively get all dependency paths from the reverse dependency tree
 */
function getReverseDependencyPaths(
  dependents: PnpmWhyDependent[],
  currentPath: Array<{ name: string; rawSpec?: string }>,
  results: Array<Array<{ name: string; rawSpec?: string }>> = []
): Array<Array<{ name: string; rawSpec?: string }>> {
  if (dependents.length === 0) {
    results.push(currentPath.reverse()); // Reverse to get root -> target order
    return results;
  }

  for (const dependent of dependents) {
    const newSegment = { name: `${dependent.name}@${dependent.version}`, rawSpec: undefined }; // pnpm why doesn't provide rawSpec for dependents directly
    const newPath = [...currentPath, newSegment];
    getReverseDependencyPaths(dependent.dependents || [], newPath, results);
  }
  return results;
}
