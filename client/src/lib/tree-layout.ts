import type { TreeNode } from '../types'

export interface PositionedNode {
  id: string
  name: string
  position: [number, number, number]
  parentId: string | null
  depth: number
  childCount: number
}

const RING_RADIUS_BASE = 5
const RING_RADIUS_STEP = 4.2
const Y_STEP = 1.9

export function layoutTree3D(tree: TreeNode | null): PositionedNode[] {
  if (!tree) return []
  const result: PositionedNode[] = []

  function traverse(
    node: TreeNode,
    parentId: string | null,
    parentPos: [number, number, number],
    depth: number,
    angleStart: number,
    angleSpan: number,
  ) {
    let position: [number, number, number]
    if (depth === 0) {
      position = [0, 0, 0]
    } else {
      const radius = RING_RADIUS_BASE + (depth - 1) * RING_RADIUS_STEP
      const angle = angleStart + angleSpan / 2
      position = [
        parentPos[0] + Math.cos(angle) * radius,
        parentPos[1] - depth * Y_STEP,
        parentPos[2] + Math.sin(angle) * radius,
      ]
    }

    result.push({
      id: node.id,
      name: node.name,
      position,
      parentId,
      depth,
      childCount: node.children?.length ?? 0,
    })

    const children = node.children ?? []
    if (children.length > 0) {
      const childAngleSpan = depth === 0
        ? (Math.PI * 2) / children.length
        : angleSpan / children.length
      const childAngleStart = depth === 0 ? 0 : angleStart

      children.forEach((child, i) => {
        const start = childAngleStart + i * childAngleSpan
        traverse(child, node.id, position, depth + 1, start, childAngleSpan)
      })
    }
  }

  traverse(tree, null, [0, 0, 0], 0, 0, Math.PI * 2)
  return result
}

export function findClosestNode(
  filePath: string,
  nodes: PositionedNode[],
  root: string | null,
): PositionedNode | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  let current = filePath
  while (current) {
    const node = nodeMap.get(current)
    if (node) return node
    const lastSlash = current.lastIndexOf('/')
    if (lastSlash <= 0) break
    current = current.substring(0, lastSlash)
  }
  if (root) return nodeMap.get(root) ?? null
  return null
}
