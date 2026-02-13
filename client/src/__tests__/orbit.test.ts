import { describe, it, expect } from 'vitest'
import { computeAgentOrbit, computeHoldingPattern } from '../lib/orbit'

describe('computeAgentOrbit', () => {
  it('returns a position at orbit radius from target', () => {
    const target: [number, number, number] = [5, 0, 5]
    const result = computeAgentOrbit(target, 0, 2.0, 0)
    const dx = result[0] - target[0]
    const dy = result[1] - target[1]
    const dz = result[2] - target[2]
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    expect(dist).toBeCloseTo(2.0, 0)
  })

  it('different time values produce different positions', () => {
    const target: [number, number, number] = [0, 0, 0]
    const pos1 = computeAgentOrbit(target, 0, 2.0, 0)
    const pos2 = computeAgentOrbit(target, 0, 2.0, 5)
    const differs = pos1[0] !== pos2[0] || pos1[1] !== pos2[1] || pos1[2] !== pos2[2]
    expect(differs).toBe(true)
  })

  it('different agent indices produce different positions at same time', () => {
    const target: [number, number, number] = [0, 0, 0]
    const pos1 = computeAgentOrbit(target, 0, 2.0, 3)
    const pos2 = computeAgentOrbit(target, 1, 2.0, 3)
    const differs = pos1[0] !== pos2[0] || pos1[1] !== pos2[1] || pos1[2] !== pos2[2]
    expect(differs).toBe(true)
  })
})

describe('computeHoldingPattern', () => {
  it('returns a position near origin for idle agents', () => {
    const result = computeHoldingPattern(0, 3, 0)
    const dist = Math.sqrt(result[0] ** 2 + result[1] ** 2 + result[2] ** 2)
    expect(dist).toBeGreaterThan(0)
    expect(dist).toBeLessThan(20)
  })
})
