import { describe, it, expect } from 'vitest'
import { analyzeOverrides } from '../src/index'

describe('analyzeOverrides', () => {
  it('should return an empty array initially', () => {
    const result = analyzeOverrides()
    expect(result).toEqual([])
  })

  it('should return an array', () => {
    const result = analyzeOverrides()
    expect(Array.isArray(result)).toBe(true)
  })
})
