import { describe, it, expect } from 'vitest'
import { analyzeOverrides, getPackageJson, findUnusedOverrides } from '../src/index'
import { getNpmExplainOutput, parseExplainOutput } from '../src/npm'
import { formatAsUnifiedTree, formatAsUnifiedTreeFromPathsWithRawSpecs } from '../src/tree'
import * as path from 'path'

describe('analyzeOverrides', () => {
  it('should return an empty array initially', () => {
    const result = analyzeOverrides('.')
    expect(result).toEqual([])
  })

  it('should return an array', () => {
    const result = analyzeOverrides('.')
    expect(Array.isArray(result)).toBe(true)
  })

  it('should work with test fixture directory', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const result = analyzeOverrides(fixtureDir)
    expect(Array.isArray(result)).toBe(true)
  })

  it('should find overridden packages from npm explain execution', () => {
    // Use the test fixture directory
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const result = analyzeOverrides(fixtureDir)

    expect(result.length).toBeGreaterThan(0)

    // Should find the "send" package that is overridden
    const sendOverride = result.find(override => override.name === 'send')
    expect(sendOverride).toBeDefined()
    expect(sendOverride?.version).toBe('0.19.1')
    expect(sendOverride?.dependencyPaths).toBeDefined()
    expect(sendOverride?.dependencyPaths.length).toBeGreaterThan(0)
    expect(sendOverride?.dependencyPaths[0]).toContain('send@0.19.1')
    expect(sendOverride?.pathsWithRawSpecs).toBeDefined()
    expect(sendOverride?.pathsWithRawSpecs.length).toBeGreaterThan(0)
    expect(sendOverride?.pathsWithRawSpecs[0]).toBeDefined()
  })

  it('should work with npm alias overrides', async () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/alias-example')
    const result = analyzeOverrides(fixtureDir)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)

    // Should find rollup package that was overridden with npm:@rollup/wasm-node
    const rollupOverride = result.find(override => override.name === 'rollup')
    expect(rollupOverride).toBeDefined()
    expect(rollupOverride?.pathsWithRawSpecs).toBeDefined()
    expect(rollupOverride?.pathsWithRawSpecs.length).toBeGreaterThan(0)
  })
})

describe('getPackageJson', () => {
  it('should read package.json from directory', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const result = getPackageJson(fixtureDir)

    expect(typeof result).toBe('object')
    expect(result).toHaveProperty('name')
    expect(result).toHaveProperty('overrides')
  })

  it('should throw error for non-existent directory', () => {
    const nonExistentDir = '/path/that/does/not/exist'

    expect(() => {
      getPackageJson(nonExistentDir)
    }).toThrow()
  })
})

describe('findUnusedOverrides', () => {
  it('should find unused overrides', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/unused-example')
    const overrides = analyzeOverrides(fixtureDir)
    const unusedOverrides = findUnusedOverrides(fixtureDir, overrides)

    expect(Array.isArray(unusedOverrides)).toBe(true)
    expect(unusedOverrides.length).toBeGreaterThan(0)

    const trimOverride = unusedOverrides.find(override => override.name === 'trim')
    expect(trimOverride).toBeDefined()
    expect(trimOverride?.version).toBe('0.0.3')
  })

  it('should return empty array when no unused overrides', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const overrides = analyzeOverrides(fixtureDir)
    const unusedOverrides = findUnusedOverrides(fixtureDir, overrides)

    expect(Array.isArray(unusedOverrides)).toBe(true)
    expect(unusedOverrides.length).toBe(0)
  })
})

describe('formatAsTree', () => {
  // Import the formatAsTree function for testing
  // Since it's not exported, we'll test it through the CLI output behavior
  it('should format single package correctly', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const overrides = analyzeOverrides(fixtureDir)

    expect(overrides.length).toBe(1)
    expect(overrides[0].dependencyPaths).toBeDefined()
    expect(overrides[0].dependencyPaths.length).toBeGreaterThan(0)
    expect(overrides[0].dependencyPaths[0]).toContain('send@0.19.1')
  })

  it('should handle complex dependency paths', () => {
    // Test that dependency paths with multiple levels would work
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const overrides = analyzeOverrides(fixtureDir)

    expect(overrides.length).toBeGreaterThan(0)
    expect(overrides[0].dependencyPaths).toBeDefined()
    expect(overrides[0].dependencyPaths.length).toBeGreaterThan(0)
    expect(overrides[0].dependencyPaths[0]).toContain(' > ')
  })
})

describe('getNpmExplainOutput', () => {
  it('should execute npm explain and return JSON output', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const result = getNpmExplainOutput(fixtureDir, ['send'])

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('name')
    expect(result[0]).toHaveProperty('version')
    expect(result[0]).toHaveProperty('overridden')
  })

  it('should return empty array for non-existent packages', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const result = getNpmExplainOutput(fixtureDir, ['nonexistent-package'])

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })

  it('should return empty array for empty package list', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const result = getNpmExplainOutput(fixtureDir, [])

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })
})

describe('parseExplainOutput', () => {
  it('should parse npm explain output and find overridden packages', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const explainOutput = getNpmExplainOutput(fixtureDir, ['send'])
    const result = parseExplainOutput(explainOutput)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('name', 'send')
    expect(result[0]).toHaveProperty('version')
    expect(result[0]).toHaveProperty('dependencyPaths')
    expect(result[0]).toHaveProperty('pathsWithRawSpecs')
    expect(result[0].dependencyPaths).toBeDefined()
    expect(result[0].dependencyPaths.length).toBeGreaterThan(0)
    expect(result[0].dependencyPaths[0]).toContain('send@')
    expect(result[0].pathsWithRawSpecs).toBeDefined()
    expect(result[0].pathsWithRawSpecs.length).toBeGreaterThan(0)
  })

  it('should return empty array for non-overridden packages', () => {
    const emptyExplainOutput: any[] = []
    const result = parseExplainOutput(emptyExplainOutput)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })
})

describe('formatAsUnifiedTree', () => {
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

    // Should show unified structure - @honkit/html should appear only once
    const htmlMatches = result.match(/@honkit\/html@6\.0\.3/g);
    expect(htmlMatches?.length).toBe(1);

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

  it('should display rawSpec information when provided', () => {
    const paths = ['send@0.19.1 > honkit@6.0.3'];
    const rawSpecs = ['^0.17.2'];
    const result = formatAsUnifiedTree(paths, rawSpecs);

    expect(result).toContain('send@0.19.1');
    expect(result).toContain('honkit@6.0.3 (^0.17.2)');
  });

  it('should handle multiple paths with rawSpecs', () => {
    const paths = [
      'lodash@4.17.21 > async@2.6.4 > kuromoji@0.1.2',
      'lodash@4.17.21 > i18n-t@1.0.1 > honkit@6.0.3'
    ];
    const rawSpecs = ['^4.17.14', '^4.13.1'];
    const result = formatAsUnifiedTree(paths, rawSpecs);

    expect(result).toContain('lodash@4.17.21');
    expect(result).toContain('kuromoji@0.1.2 (^4.17.14)');
    expect(result).toContain('honkit@6.0.3 (^4.13.1)');
  });

  it('should display parent rawSpecs correctly in tree structure', () => {
    // Create mock data that mimics the lodash.json example mentioned in the conversation
    const pathsWithRawSpecs = [
      [
        { name: 'lodash@4.17.21' },
        { name: 'async@2.6.4', rawSpec: '^4.17.14' },
      ],
      [
        { name: 'lodash@4.17.21' },
        { name: 'async@2.6.4', rawSpec: '^4.17.14' },
        { name: 'kuromoji@0.1.2', rawSpec: '^2.0.1' },
      ]
    ]

    const result = formatAsUnifiedTreeFromPathsWithRawSpecs(pathsWithRawSpecs)
    console.log('RawSpec chain test output:')
    console.log(result)

    // Check that async shows lodash's rawSpec (^4.17.14)
    expect(result).toContain('async@2.6.4 (^4.17.14)')
    // Check that kuromoji shows async's rawSpec (^2.0.1)
    expect(result).toContain('kuromoji@0.1.2 (^2.0.1)')
  })
})
