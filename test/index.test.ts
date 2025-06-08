import { describe, it, expect } from 'vitest'
import { analyzeOverrides, getNpmLsOutput } from '../src/index'
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
