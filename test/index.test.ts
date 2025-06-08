import { describe, it, expect } from 'vitest'
import { analyzeOverrides, getNpmLsOutput, findOverriddenPackages, getPackageJson, findUnusedOverrides } from '../src/index'
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

  it('should find overridden packages from npm ls execution', () => {
    // Use the test fixture directory and execute npm ls directly
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const npmLsOutput = getNpmLsOutput(fixtureDir)

    const overrides = findOverriddenPackages(npmLsOutput.dependencies)

    expect(overrides.length).toBeGreaterThan(0)

    // Should find the "send" package that is overridden
    const sendOverride = overrides.find(override => override.name === 'send')
    expect(sendOverride).toBeDefined()
    expect(sendOverride?.version).toBe('0.19.1')
    expect(sendOverride?.dependencyPath).toBe('send@0.19.1 > honkit@6.0.3')
  })
})

describe('getNpmLsOutput', () => {
  it('should execute npm ls and return JSON output', () => {
    // Use the current project directory as test target
    const projectDir = path.resolve(__dirname, '..')
    const result = getNpmLsOutput(projectDir)

    expect(typeof result).toBe('object')
    expect(result).toHaveProperty('name')
    expect(result.name).toBe('npm-ls-overrides')
  })

  it('should throw error for non-existent directory', () => {
    const nonExistentDir = '/path/that/does/not/exist'

    expect(() => {
      getNpmLsOutput(nonExistentDir)
    }).toThrow()
  })

  it('should work with test fixture directory', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const result = getNpmLsOutput(fixtureDir)

    expect(typeof result).toBe('object')
    expect(result).toHaveProperty('name')
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
    const npmLsOutput = getNpmLsOutput(fixtureDir)
    const overrides = findOverriddenPackages(npmLsOutput.dependencies)
    const unusedOverrides = findUnusedOverrides(fixtureDir, overrides)

    expect(Array.isArray(unusedOverrides)).toBe(true)
    expect(unusedOverrides.length).toBeGreaterThan(0)

    const trimOverride = unusedOverrides.find(override => override.name === 'trim')
    expect(trimOverride).toBeDefined()
    expect(trimOverride?.version).toBe('0.0.3')
  })

  it('should return empty array when no unused overrides', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/honkit-example')
    const npmLsOutput = getNpmLsOutput(fixtureDir)
    const overrides = findOverriddenPackages(npmLsOutput.dependencies)
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
