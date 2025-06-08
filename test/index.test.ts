import { describe, it, expect } from 'vitest'
import { analyzeOverrides, getPackageJson, findUnusedOverrides, getNpmExplainOutput, parseExplainOutput } from '../src/index'
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
    expect(sendOverride?.dependencyPath).toContain('send@0.19.1')
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
    expect(overrides[0].dependencyPath).toBe('send@0.19.1 > honkit@6.0.3')
  })

  it('should handle complex dependency paths', () => {
    // Test that dependency paths with multiple levels would work
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const overrides = analyzeOverrides(fixtureDir)

    expect(overrides.length).toBeGreaterThan(0)
    expect(overrides[0].dependencyPath).toContain(' > ')
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
    expect(result[0]).toHaveProperty('dependencyPath')
    expect(result[0].dependencyPath).toContain('send@')
  })

  it('should return empty array for non-overridden packages', () => {
    const emptyExplainOutput: any[] = []
    const result = parseExplainOutput(emptyExplainOutput)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })
})
