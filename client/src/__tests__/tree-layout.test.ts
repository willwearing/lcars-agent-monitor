import { describe, it, expect } from 'vitest'
import { layoutTree3D, findClosestNode, type PositionedNode } from '../lib/tree-layout'
import type { TreeNode } from '../types'

describe('layoutTree3D', () => {
  it('returns empty array for null tree', () => {
    expect(layoutTree3D(null)).toEqual([])
  })

  it('positions root node at origin', () => {
    const tree: TreeNode = { id: '/root', name: 'root', type: 'folder' }
    const result = layoutTree3D(tree)
    expect(result).toHaveLength(1)
    expect(result[0]!.position).toEqual([0, 0, 0])
  })

  it('positions children in a ring around parent', () => {
    const tree: TreeNode = {
      id: '/root', name: 'root', type: 'folder',
      children: [
        { id: '/root/src', name: 'src', type: 'folder' },
        { id: '/root/tests', name: 'tests', type: 'folder' },
        { id: '/root/docs', name: 'docs', type: 'folder' },
      ],
    }
    const result = layoutTree3D(tree)
    expect(result).toHaveLength(4)
    const children = result.filter((n) => n.id !== '/root')
    for (const child of children) {
      const dist = Math.sqrt(child.position[0] ** 2 + child.position[1] ** 2 + child.position[2] ** 2)
      expect(dist).toBeGreaterThan(0)
      expect(child.parentId).toBe('/root')
    }
  })

  it('deeper nodes are further from origin', () => {
    const tree: TreeNode = {
      id: '/root', name: 'root', type: 'folder',
      children: [{
        id: '/root/src', name: 'src', type: 'folder',
        children: [{ id: '/root/src/components', name: 'components', type: 'folder' }],
      }],
    }
    const result = layoutTree3D(tree)
    const src = result.find((n) => n.id === '/root/src')!
    const comp = result.find((n) => n.id === '/root/src/components')!
    const srcDist = Math.sqrt(src.position[0] ** 2 + src.position[1] ** 2 + src.position[2] ** 2)
    const compDist = Math.sqrt(comp.position[0] ** 2 + comp.position[1] ** 2 + comp.position[2] ** 2)
    expect(compDist).toBeGreaterThan(srcDist)
  })
})

describe('findClosestNode', () => {
  it('finds exact match', () => {
    const nodes: PositionedNode[] = [
      { id: '/root', name: 'root', position: [0, 0, 0], parentId: null, depth: 0, childCount: 1 },
      { id: '/root/src', name: 'src', position: [5, 0, 0], parentId: '/root', depth: 1, childCount: 0 },
    ]
    const result = findClosestNode('/root/src', nodes, '/root')
    expect(result?.id).toBe('/root/src')
  })

  it('walks up to find ancestor', () => {
    const nodes: PositionedNode[] = [
      { id: '/root', name: 'root', position: [0, 0, 0], parentId: null, depth: 0, childCount: 1 },
      { id: '/root/src', name: 'src', position: [5, 0, 0], parentId: '/root', depth: 1, childCount: 0 },
    ]
    const result = findClosestNode('/root/src/deep/file.ts', nodes, '/root')
    expect(result?.id).toBe('/root/src')
  })
})
