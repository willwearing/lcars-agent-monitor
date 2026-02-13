import { describe, it, expect } from 'vitest'
import { computeAutoPanTarget } from '../lib/auto-pan-target'
import type { PositionedNode } from '../lib/tree-layout'

const nodes: PositionedNode[] = [
  { id: '/root', name: 'root', position: [0, 0, 0], parentId: null, depth: 0, childCount: 2 },
  { id: '/root/src', name: 'src', position: [5, -1.9, 0], parentId: '/root', depth: 1, childCount: 1 },
  { id: '/root/tests', name: 'tests', position: [-5, -1.9, 0], parentId: '/root', depth: 1, childCount: 0 },
  { id: '/root/src/lib', name: 'lib', position: [8, -3.8, 2], parentId: '/root/src', depth: 2, childCount: 0 },
]

interface MinimalAgent {
  id: string
  currentFile: string | null
  workspace?: string
  status: string
}

describe('computeAutoPanTarget', () => {
  it('returns null when no agents are active', () => {
    const agents: MinimalAgent[] = []
    expect(computeAutoPanTarget(agents, nodes, null)).toBeNull()
  })

  it('returns null when all agents are idle', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: '/root/src', status: 'idle' },
    ]
    expect(computeAutoPanTarget(agents, nodes, null)).toBeNull()
  })

  it('returns position of the node an active agent is working in', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: '/root/src', status: 'reading' },
    ]
    const target = computeAutoPanTarget(agents, nodes, null)
    expect(target).toEqual([5, -1.9, 0])
  })

  it('returns centroid of multiple active agents', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: '/root/src', status: 'reading' },
      { id: 'a2', currentFile: '/root/tests', status: 'writing' },
    ]
    const target = computeAutoPanTarget(agents, nodes, null)
    // Average of [5, -1.9, 0] and [-5, -1.9, 0]
    expect(target).toEqual([0, -1.9, 0])
  })

  it('walks up file path to find nearest ancestor node', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: '/root/src/lib/deep/file.ts', status: 'writing' },
    ]
    const target = computeAutoPanTarget(agents, nodes, null)
    // Nearest ancestor is /root/src/lib at [8, -3.8, 2]
    expect(target).toEqual([8, -3.8, 2])
  })

  it('falls back to root node when file path has no match', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: '/unknown/path', status: 'reading' },
    ]
    const target = computeAutoPanTarget(agents, nodes, '/root')
    // Falls back to root at [0, 0, 0]
    expect(target).toEqual([0, 0, 0])
  })

  it('skips agents with no currentFile or workspace', () => {
    const agents: MinimalAgent[] = [
      { id: 'a1', currentFile: null, status: 'executing' },
      { id: 'a2', currentFile: '/root/src', status: 'reading' },
    ]
    const target = computeAutoPanTarget(agents, nodes, null)
    expect(target).toEqual([5, -1.9, 0])
  })
})
