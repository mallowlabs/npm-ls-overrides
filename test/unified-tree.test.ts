import { describe, it, expect } from 'vitest'
import { formatAsUnifiedTree, buildTreeFromPaths } from '../src/index'

// Test the unified tree formatting with complex paths
describe('Unified Tree Formatting', () => {
  it('should create unified tree from multiple paths', () => {
    const paths = [
      'cheerio@1.0.0-rc.12 > @honkit/html@6.0.3 > @honkit/asciidoc@6.0.3 > honkit@6.0.3',
      'cheerio@1.0.0-rc.12 > @honkit/html@6.0.3 > @honkit/markdown-legacy@6.0.3 > honkit@6.0.3'
    ];

    const result = formatAsUnifiedTree(paths);

    expect(result).toContain('cheerio@1.0.0-rc.12');
    expect(result).toContain('@honkit/html@6.0.3');
    expect(result).toContain('@honkit/asciidoc@6.0.3');
    expect(result).toContain('@honkit/markdown-legacy@6.0.3');

    // The result should show the unified tree structure
    console.log('Unified tree output:');
    console.log(result);
  });

  it('should handle single path correctly', () => {
    const paths = ['send@0.19.1 > honkit@6.0.3'];
    const result = formatAsUnifiedTree(paths);

    expect(result).toContain('send@0.19.1');
    expect(result).toContain('honkit@6.0.3');
  });

  it('should handle empty paths array', () => {
    const paths: string[] = [];
    const result = formatAsUnifiedTree(paths);

    expect(result).toBe('');
  });
});
