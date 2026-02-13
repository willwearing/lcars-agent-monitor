import { describe, it, expect } from 'vitest'
import { toStardate, formatStardate, formatElapsed } from '../lib/stardate'

describe('toStardate', () => {
  it('converts a unix timestamp to a stardate number', () => {
    const result = toStardate(Date.now())
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThan(0)
  })

  it('produces increasing stardates for increasing timestamps', () => {
    const earlier = toStardate(1000000)
    const later = toStardate(2000000)
    expect(later).toBeGreaterThan(earlier)
  })
})

describe('formatStardate', () => {
  it('returns a formatted string like "SD 78432.7"', () => {
    const result = formatStardate(Date.now())
    expect(result).toMatch(/^SD \d+\.\d$/)
  })
})

describe('formatElapsed', () => {
  it('formats milliseconds into HH:MM:SS', () => {
    expect(formatElapsed(0)).toBe('00:00:00')
    expect(formatElapsed(3661000)).toBe('01:01:01')
    expect(formatElapsed(90000)).toBe('00:01:30')
  })
})
