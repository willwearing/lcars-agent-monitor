import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'
import { EVE, BRANCH_PALETTE } from '../../lib/eve-colors'
import { CelestialBody } from './CelestialBody'
import { OrbitalPath } from './OrbitalPath'
import { Bracket } from './Brackets'
import { ScanBeam } from './ScanBeam'

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()

// Shared geometry + material for instanced bulk nodes (depth 2+)
const bulkGeometry = new THREE.SphereGeometry(1, 8, 8)
const bulkMaterial = new THREE.MeshStandardMaterial({
  roughness: 0.4,
  metalness: 0.3,
  toneMapped: false,
})

interface BranchStyle {
  color: string
  emissive: string
  label: string
  active: string
}

interface NodeRenderData {
  id: string
  name: string
  position: [number, number, number]
  parentId: string | null
  depth: number
  childCount: number
  size: number
  style: BranchStyle
  branchIndex: number
}

function branchStyleFrom(base: string): BranchStyle {
  const anchor = new THREE.Color(base)
  const label = anchor.clone().lerp(new THREE.Color('#ffffff'), 0.4)
  const active = anchor.clone().lerp(new THREE.Color('#ffffff'), 0.6)
  return {
    color: `#${anchor.getHexString()}`,
    emissive: `#${anchor.getHexString()}`,
    label: `#${label.getHexString()}`,
    active: `#${active.getHexString()}`,
  }
}

export function SystemMap() {
  const agents = useStore((s) => s.agents)
  const selectedProviders = useStore((s) => s.selectedProviders)
  const visibleAgents = agents.filter((agent) => selectedProviders.includes(agent.provider))

  const positionedNodes = useStore((s) => s.positionedNodes)
  const nodeMap = useMemo(() => new Map(positionedNodes.map((n) => [n.id, n])), [positionedNodes])

  const bulkRef = useRef<THREE.InstancedMesh>(null)
  const previousVisibleIdsRef = useRef<Set<string>>(new Set())
  const nodeAppearTimeRef = useRef<Map<string, number>>(new Map())
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Compute active node IDs from agent positions
  const activeNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const agent of visibleAgents) {
      if (agent.status === 'idle') continue
      const filePath = agent.currentFile || agent.workspace
      if (!filePath) continue
      let path = filePath
      while (path) {
        if (nodeMap.has(path)) {
          ids.add(path)
          break
        }
        const lastSlash = path.lastIndexOf('/')
        if (lastSlash <= 0) break
        path = path.substring(0, lastSlash)
      }
    }
    return ids
  }, [visibleAgents, nodeMap])

  // Show all nodes — the full solar system is always visible
  const filteredNodes = positionedNodes

  // Compute per-node render data with branch coloring
  const nodeData = useMemo(() => {
    const depth1Nodes = filteredNodes.filter((n) => n.depth === 1)
    const branchStyleMap = new Map<string, { style: BranchStyle; index: number }>()
    depth1Nodes.forEach((node, i) => {
      const idx = i % BRANCH_PALETTE.length
      branchStyleMap.set(node.id, { style: branchStyleFrom(BRANCH_PALETTE[idx]), index: idx })
    })

    return filteredNodes.map((node): NodeRenderData => {
      const isRoot = node.depth === 0
      const size = isRoot
        ? 1.2
        : node.depth === 1
          ? 0.4 + Math.min(node.childCount * 0.04, 0.3)
          : 0.15 + Math.min(node.childCount * 0.02, 0.1)

      let style = branchStyleFrom(EVE.primary)
      let branchIndex = -1

      if (isRoot) {
        style = branchStyleFrom(EVE.warm)
      } else if (node.depth === 1) {
        const entry = branchStyleMap.get(node.id)
        style = entry?.style ?? branchStyleFrom(EVE.warm)
        branchIndex = entry?.index ?? -1
      } else if (node.depth >= 2) {
        // Walk up to depth-1 ancestor to find branch color
        let current = node
        while (current.depth > 1 && current.parentId) {
          const parent = nodeMap.get(current.parentId)
          if (!parent) break
          current = parent
        }
        const entry = branchStyleMap.get(current.id)
        style = entry?.style ?? branchStyleFrom(EVE.warm)
        branchIndex = entry?.index ?? -1
      }

      return {
        id: node.id,
        name: node.name,
        position: node.position,
        parentId: node.parentId,
        depth: node.depth,
        childCount: node.childCount,
        size,
        style,
        branchIndex,
      }
    })
  }, [filteredNodes, nodeMap])

  // Split nodes: important ones (root, depth-1, active) get CelestialBody; rest get instanced
  const importantNodes = useMemo(
    () => nodeData.filter((n) => n.depth === 0 || n.depth === 1 || activeNodeIds.has(n.id)),
    [nodeData, activeNodeIds],
  )

  const bulkNodes = useMemo(
    () => nodeData.filter((n) => n.depth >= 2 && !activeNodeIds.has(n.id)),
    [nodeData, activeNodeIds],
  )

  // Parent/child links for directory tree edges
  const linkGeometry = useMemo(() => {
    const positions: number[] = []
    const colors: number[] = []
    const base = new THREE.Color()
    const parentColor = new THREE.Color('#0b0f18')

    for (const node of nodeData) {
      if (!node.parentId) continue
      const parent = nodeMap.get(node.parentId)
      if (!parent) continue

      positions.push(
        parent.position[0], parent.position[1], parent.position[2],
        node.position[0], node.position[1], node.position[2],
      )

      const fade = Math.max(0.22, 1 - node.depth * 0.14)
      base.set(node.style.color).lerp(parentColor, 0.5).multiplyScalar(fade * 0.7)
      colors.push(
        base.r, base.g, base.b,
        base.r, base.g, base.b,
      )
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geometry
  }, [nodeData, nodeMap])

  useEffect(() => {
    return () => linkGeometry.dispose()
  }, [linkGeometry])

  const linkMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }),
    [],
  )

  // Orbital paths: only for depth-1 nodes (one ring per top-level directory)
  const orbitalPaths = useMemo(() => {
    return nodeData
      .filter((n) => n.depth === 1 && n.parentId)
      .map((n) => {
        const parent = nodeData.find((p) => p.id === n.parentId)
        if (!parent) return null
        return { key: n.id, parentPosition: parent.position, childPosition: n.position, color: n.style.color }
      })
      .filter(Boolean) as Array<{ key: string; parentPosition: [number, number, number]; childPosition: [number, number, number]; color: string }>
  }, [nodeData])

  // Sync instanced mesh for bulk nodes
  useEffect(() => {
    if (!bulkRef.current || bulkNodes.length === 0) return
    for (let i = 0; i < bulkNodes.length; i++) {
      const node = bulkNodes[i]
      _dummy.position.set(node.position[0], node.position[1], node.position[2])
      _dummy.rotation.set(0, 0, 0)
      _dummy.scale.setScalar(node.size)
      _dummy.updateMatrix()
      bulkRef.current.setMatrixAt(i, _dummy.matrix)
      _color.set(node.style.color)
      bulkRef.current.setColorAt(i, _color)
    }
    bulkRef.current.instanceMatrix.needsUpdate = true
    if (bulkRef.current.instanceColor) bulkRef.current.instanceColor.needsUpdate = true
  }, [bulkNodes])

  // Detect newly appearing nodes for animation
  useEffect(() => {
    const currentIds = new Set(nodeData.map((n) => n.id))
    const prevIds = previousVisibleIdsRef.current

    for (const id of currentIds) {
      if (!prevIds.has(id) && !nodeAppearTimeRef.current.has(id)) {
        nodeAppearTimeRef.current.set(id, -1)
      }
    }

    for (const id of nodeAppearTimeRef.current.keys()) {
      if (!currentIds.has(id)) nodeAppearTimeRef.current.delete(id)
    }

    previousVisibleIdsRef.current = currentIds
  }, [nodeData])

  // Animate bulk node appearance
  useFrame(({ clock }) => {
    const mesh = bulkRef.current
    if (!mesh || bulkNodes.length === 0) return
    const t = clock.getElapsedTime()

    // Assign real appear times for sentinel values
    for (const [id, time] of nodeAppearTimeRef.current) {
      if (time === -1) nodeAppearTimeRef.current.set(id, t)
    }

    const APPEAR_DURATION = 0.5
    let needsUpdate = false

    for (let i = 0; i < bulkNodes.length; i++) {
      const node = bulkNodes[i]
      const appearTime = nodeAppearTimeRef.current.get(node.id)
      if (appearTime === undefined || appearTime === -1) continue

      const elapsed = t - appearTime
      if (elapsed >= APPEAR_DURATION) {
        nodeAppearTimeRef.current.delete(node.id)
        continue
      }

      const progress = elapsed / APPEAR_DURATION
      const eased = 1 - Math.pow(1 - progress, 3)
      const scale = node.size * eased

      _dummy.position.set(node.position[0], node.position[1], node.position[2])
      _dummy.rotation.set(0, 0, 0)
      _dummy.scale.setScalar(scale)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
      needsUpdate = true
    }

    if (needsUpdate) {
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  // Labels for root, depth-1, active, and hovered nodes
  const labelsToShow = useMemo(() => {
    const labels: Array<{ key: string; position: [number, number, number]; name: string; color: string; fontSize: number }> = []
    for (let i = 0; i < nodeData.length; i++) {
      const node = nodeData[i]
      const isActive = activeNodeIds.has(node.id)
      const isRoot = node.depth === 0
      if (isRoot || node.depth === 1 || isActive) {
        labels.push({
          key: node.id,
          position: [node.position[0], node.position[1] + node.size + 0.52, node.position[2]],
          name: node.name,
          color: node.style.label,
          fontSize: isRoot ? 0.7 : 0.34,
        })
      }
    }
    return labels
  }, [nodeData, activeNodeIds])

  // Active nodes for scan beams
  const activeNodes = useMemo(() => {
    return nodeData.filter((n) => activeNodeIds.has(n.id))
  }, [nodeData, activeNodeIds])

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.instanceId !== undefined) setHoveredIndex(e.instanceId)
  }
  const handlePointerOut = () => setHoveredIndex(null)

  if (nodeData.length === 0) return null

  return (
    <group>
      {/* Parent/child links across directory layers */}
      {linkGeometry.getAttribute('position').count > 0 && (
        <lineSegments geometry={linkGeometry} material={linkMaterial} />
      )}

      {/* Orbital paths for depth-1 nodes */}
      {orbitalPaths.map((op) => (
        <OrbitalPath
          key={op.key}
          parentPosition={op.parentPosition}
          childPosition={op.childPosition}
          color={op.color}
        />
      ))}

      {/* Important nodes (root, depth-1, active): individual CelestialBody meshes */}
      {importantNodes.map((node) => (
        <CelestialBody
          key={node.id}
          position={node.position}
          depth={node.depth}
          childCount={node.childCount}
          isActive={activeNodeIds.has(node.id)}
          color={node.style.color}
          emissiveColor={node.style.emissive}
        />
      ))}

      {/* Bulk depth-2+ nodes: instanced mesh */}
      {bulkNodes.length > 0 && (
        <instancedMesh
          key={bulkNodes.length}
          ref={bulkRef}
          args={[bulkGeometry, bulkMaterial, bulkNodes.length]}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      )}

      {/* Scan beams on active nodes */}
      {activeNodes.map((node) => (
        <group key={`scan-${node.id}`} position={node.position}>
          <ScanBeam color={node.style.active} />
        </group>
      ))}

      {/* Labels */}
      {labelsToShow.map((label) => (
        <Bracket
          key={label.key}
          position={label.position}
          label={label.name.toUpperCase()}
          color={label.color}
          fontSize={label.fontSize}
        />
      ))}
    </group>
  )
}
