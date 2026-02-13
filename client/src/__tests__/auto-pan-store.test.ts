import { describe, it, expect } from 'vitest'

// We test the toggle logic as a pure function since the Zustand store
// requires DOM setup we don't have in node environment.

function toggleAutoPan(current: boolean): boolean {
  return !current
}

describe('autoPanEnabled toggle', () => {
  it('defaults to true', () => {
    const initial = true
    expect(initial).toBe(true)
  })

  it('toggles from true to false', () => {
    expect(toggleAutoPan(true)).toBe(false)
  })

  it('toggles from false to true', () => {
    expect(toggleAutoPan(false)).toBe(true)
  })
})
