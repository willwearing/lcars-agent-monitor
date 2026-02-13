import { describe, it, expect } from 'vitest'
import { validateRootPath, getPreferredRoot } from '../services/TreeScanner'

describe('validateRootPath', () => {
  it('accepts a path inside PREFERRED_ROOT', () => {
    const preferred = getPreferredRoot()
    expect(validateRootPath(`${preferred}/some-project`)).toBe(true)
  })

  it('accepts PREFERRED_ROOT itself', () => {
    const preferred = getPreferredRoot()
    expect(validateRootPath(preferred)).toBe(true)
  })

  it('rejects a path outside PREFERRED_ROOT', () => {
    expect(validateRootPath('/etc/passwd')).toBe(false)
  })

  it('rejects path traversal via ..', () => {
    const preferred = getPreferredRoot()
    expect(validateRootPath(`${preferred}/../../../etc/passwd`)).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateRootPath('')).toBe(false)
  })
})
