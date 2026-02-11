export interface TreeNode {
  name: string;
  rawSpec?: string;
  children: Map<string, TreeNode>;
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
