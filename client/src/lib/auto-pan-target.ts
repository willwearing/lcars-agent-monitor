import type { PositionedNode } from './tree-layout'

interface AgentLike {
  currentFile: string | null
  workspace?: string
  status: string
}

/**
 * Compute the centroid position the camera should pan to,
 * based on where active agents are working in the tree.
 * Returns null if no agents are active (camera stays put).
 */
export function computeAutoPanTarget(
  agents: AgentLike[],
  nodes: PositionedNode[],
  root: string | null,
): [number, number, number] | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  const positions: [number, number, number][] = []

  for (const agent of agents) {
    const filePath = agent.currentFile || agent.workspace
    if (!filePath) continue

    let path = filePath
    let found = false
    while (path) {
      const node = nodeMap.get(path)
      if (node) {
        positions.push(node.position)
        found = true
        break
      }
      const lastSlash = path.lastIndexOf('/')
      if (lastSlash <= 0) break
      path = path.substring(0, lastSlash)
    }

    if (!found && root) {
      const rootNode = nodeMap.get(root)
      if (rootNode) positions.push(rootNode.position)
    }
  }

  if (positions.length === 0) {
    // No locatable agents — fall back to root so camera drifts back to overview
    if (root) {
      const rootNode = nodeMap.get(root)
      if (rootNode) return rootNode.position
    }
    return null
  }

  const sum: [number, number, number] = [0, 0, 0]
  for (const pos of positions) {
    sum[0] += pos[0]
    sum[1] += pos[1]
    sum[2] += pos[2]
  }

  return [
    sum[0] / positions.length,
    sum[1] / positions.length,
    sum[2] / positions.length,
  ]
}
