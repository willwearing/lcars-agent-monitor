import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../../store'
import { LCARS, BRANCH_PALETTE } from '../../lib/lcars-colors'
import { ScanSweep } from './ScanSweep'

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()
const _vectorA = new THREE.Vector3()
const _vectorB = new THREE.Vector3()
const _vectorC = new THREE.Vector3()
const _vectorD = new THREE.Vector3()

const EDGE_CURVE_STEPS = 10

// ── Ring + glow textures (canvas, created once) ──────────────────
function createRingTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2

  // Soft glow halo behind ring (draw first, underneath)
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 12
  ctx.stroke()

  // Main ring outline — crisp
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Bright center dot
  const dot = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.04)
  dot.addColorStop(0, 'rgba(255,255,255,1.0)')
  dot.addColorStop(0.6, 'rgba(255,255,255,0.3)')
  dot.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = dot
  ctx.fillRect(0, 0, size, size)

  return new THREE.CanvasTexture(canvas)
}

const ringTexture = createRingTexture()
const nodeGeometry = new THREE.PlaneGeometry(1, 1)

// ── Ring billboard material ──────────────────────────────────────
const RING_SIZE = 2.8 // size multiplier for the billboard quad
const ringMaterial = new THREE.ShaderMaterial({
  uniforms: {
    map: { value: ringTexture },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vColor;

    void main() {
      vUv = uv;
      vColor = vec3(1.0);
      #ifdef USE_INSTANCING_COLOR
        vColor = instanceColor;
      #endif

      vec3 instancePos = vec3(
        instanceMatrix[3][0],
        instanceMatrix[3][1],
        instanceMatrix[3][2]
      );
      float scale = length(vec3(
        instanceMatrix[0][0],
        instanceMatrix[0][1],
        instanceMatrix[0][2]
      ));

      // Billboard in view space
      vec4 viewPos = modelViewMatrix * vec4(instancePos, 1.0);
      viewPos.xy += position.xy * scale * ${RING_SIZE.toFixed(1)};

      gl_Position = projectionMatrix * viewPos;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D map;
    varying vec2 vUv;
    varying vec3 vColor;

    void main() {
      vec4 tex = texture2D(map, vUv);
      float brightness = tex.r;
      gl_FragColor = vec4(vColor * brightness, brightness * 0.85);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  side: THREE.DoubleSide,
})

interface BranchStyle {
  nodeCore: THREE.Color
  edge: THREE.Color
  label: THREE.Color
  active: THREE.Color
}

interface NodeRenderData {
  id: string
  name: string
  position: [number, number, number]
  depth: number
  isRoot: boolean
  size: number
  matrix: THREE.Matrix4
  style: BranchStyle
  branchIndex: number
}

function branchStyleFrom(base: string): BranchStyle {
  const anchor = new THREE.Color(base)
  const nodeCore = anchor.clone()
  const edge = anchor.clone().lerp(new THREE.Color('#ffffff'), 0.2)
  const label = anchor.clone().lerp(new THREE.Color('#ffffff'), 0.4)
  const active = anchor.clone().lerp(new THREE.Color('#ffffff'), 0.6)
  return { nodeCore, edge, label, active }
}

function appendCurveSegments(
  positions: number[],
  from: [number, number, number],
  to: [number, number, number],
) {
  _vectorA.set(from[0], from[1], from[2])
  _vectorB.set(to[0], to[1], to[2])

  _vectorC.copy(_vectorA).add(_vectorB).multiplyScalar(0.5)
  _vectorD.set(_vectorC.x, 0, _vectorC.z)
  if (_vectorD.lengthSq() < 0.001) {
    _vectorD.set(0.6, 0, 0)
  } else {
    _vectorD.normalize()
  }

  const distance = _vectorA.distanceTo(_vectorB)
  const bulge = 0.55 + distance * 0.09
  const lift = 0.2 + distance * 0.04
  const control = _vectorC.clone().addScaledVector(_vectorD, bulge)
  control.y += lift

  const curve = new THREE.QuadraticBezierCurve3(_vectorA.clone(), control, _vectorB.clone())

  for (let i = 0; i < EDGE_CURVE_STEPS; i++) {
    const t0 = i / EDGE_CURVE_STEPS
    const t1 = (i + 1) / EDGE_CURVE_STEPS
    const p0 = curve.getPoint(t0)
    const p1 = curve.getPoint(t1)
    positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
  }
}

/** Sync instance matrices + colors onto a mesh */
function syncMesh(mesh: THREE.InstancedMesh, nodeData: NodeRenderData[], colorKey: 'nodeCore' | 'active') {
  for (let i = 0; i < nodeData.length; i++) {
    mesh.setMatrixAt(i, nodeData[i].matrix)
    mesh.setColorAt(i, nodeData[i].style[colorKey])
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

export function TreeGraph3D() {
  const agents = useStore((s) => s.agents)
  const selectedProviders = useStore((s) => s.selectedProviders)
  const visibleAgents = agents.filter((agent) => selectedProviders.includes(agent.provider))

  const positionedNodes = useStore((s) => s.positionedNodes)
  const nodeMap = useMemo(() => new Map(positionedNodes.map((n) => [n.id, n])), [positionedNodes])

  const ringRef = useRef<THREE.InstancedMesh>(null)
  const previousActiveIndicesRef = useRef<number[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const activeNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const agent of visibleAgents) {
      if (agent.currentFile && agent.status !== 'idle') {
        let path = agent.currentFile
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
    }
    return ids
  }, [visibleAgents, nodeMap])

  const nodeData = useMemo(() => {
    const depth1Nodes = positionedNodes.filter((n) => n.depth === 1)
    const branchStyleMap = new Map<string, { style: BranchStyle; index: number }>()
    depth1Nodes.forEach((node, i) => {
      const idx = i % BRANCH_PALETTE.length
      branchStyleMap.set(node.id, { style: branchStyleFrom(BRANCH_PALETTE[idx]), index: idx })
    })

    return positionedNodes.map((node): NodeRenderData => {
      const isRoot = node.depth === 0
      const size = isRoot
        ? 0.68
        : node.depth === 1
          ? 0.29 + Math.min(node.childCount * 0.03, 0.18)
          : 0.15 + Math.min(node.childCount * 0.02, 0.07)

      let style = branchStyleFrom(LCARS.blue)
      let branchIndex = -1
      if (isRoot) {
        style = branchStyleFrom(LCARS.orange)
      }
      if (node.depth === 1) {
        const entry = branchStyleMap.get(node.id)
        style = entry?.style ?? branchStyleFrom(LCARS.orange)
        branchIndex = entry?.index ?? -1
      } else if (node.depth >= 2) {
        let current = node
        while (current.depth > 1 && current.parentId) {
          const parent = nodeMap.get(current.parentId)
          if (!parent) break
          current = parent
        }
        const entry = branchStyleMap.get(current.id)
        style = entry?.style ?? branchStyleFrom(LCARS.orange)
        branchIndex = entry?.index ?? -1
      }

      _dummy.position.set(node.position[0], node.position[1], node.position[2])
      _dummy.rotation.set(0, 0, 0)
      _dummy.scale.setScalar(size)
      _dummy.updateMatrix()

      return {
        id: node.id,
        name: node.name,
        position: node.position,
        depth: node.depth,
        size,
        isRoot,
        style,
        branchIndex,
        matrix: _dummy.matrix.clone(),
      }
    })
  }, [positionedNodes, nodeMap])

  // Build per-branch edge line geometries (thin lines, colored per branch)
  const edgeLines = useMemo(() => {
    const nodeDataMap = new Map(nodeData.map((n) => [n.id, n]))
    const branchPositions = new Map<number, number[]>()

    for (const node of nodeData) {
      const originalNode = nodeMap.get(node.id)
      if (!originalNode?.parentId) continue
      const parent = nodeDataMap.get(originalNode.parentId)
      if (!parent) continue

      const key = parent.isRoot ? node.branchIndex : node.branchIndex
      if (!branchPositions.has(key)) branchPositions.set(key, [])
      appendCurveSegments(branchPositions.get(key)!, parent.position, node.position)
    }

    const result: Array<{ geometry: THREE.BufferGeometry; color: THREE.Color }> = []

    for (const [branchIdx, positions] of branchPositions) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

      let edgeColor: THREE.Color
      if (branchIdx === -1) {
        edgeColor = branchStyleFrom(LCARS.orange).edge
      } else {
        edgeColor = branchStyleFrom(BRANCH_PALETTE[branchIdx % BRANCH_PALETTE.length]).edge
      }
      result.push({ geometry, color: edgeColor })
    }

    return result
  }, [nodeData, nodeMap])

  // Sync ring mesh when nodeData changes
  useEffect(() => {
    if (ringRef.current) syncMesh(ringRef.current, nodeData, 'nodeCore')
    previousActiveIndicesRef.current = []
  }, [nodeData])

  const activeIndices = useMemo(() => {
    const list: number[] = []
    for (let i = 0; i < nodeData.length; i++) {
      if (activeNodeIds.has(nodeData[i].id)) list.push(i)
    }
    return list
  }, [nodeData, activeNodeIds])

  // Restore non-active nodes when active set changes
  useEffect(() => {
    const previousActive = previousActiveIndicesRef.current
    const activeSet = new Set(activeIndices)
    let changed = false

    for (const idx of previousActive) {
      if (activeSet.has(idx)) continue
      const node = nodeData[idx]
      if (!node) continue
      const mesh = ringRef.current
      if (!mesh) continue
      mesh.setMatrixAt(idx, node.matrix)
      mesh.setColorAt(idx, node.style.nodeCore)
      changed = true
    }

    if (changed && ringRef.current) {
      ringRef.current.instanceMatrix.needsUpdate = true
      if (ringRef.current.instanceColor) ringRef.current.instanceColor.needsUpdate = true
    }
    previousActiveIndicesRef.current = activeIndices
  }, [activeIndices, nodeData])

  // Animate active nodes
  useFrame(({ clock }) => {
    if (activeIndices.length === 0) return
    const mesh = ringRef.current
    if (!mesh) return
    const t = clock.getElapsedTime()

    for (const idx of activeIndices) {
      const node = nodeData[idx]
      const pulse = 1 + Math.sin(t * 3.1 + idx * 0.25) * 0.08
      _dummy.position.set(node.position[0], node.position[1], node.position[2])
      _dummy.rotation.set(0, t * 0.18, 0)
      _dummy.scale.setScalar(node.size * pulse)
      _dummy.updateMatrix()

      _color.copy(node.style.active).offsetHSL(0, 0, Math.sin(t * 4 + idx) * 0.014)
      mesh.setMatrixAt(idx, _dummy.matrix)
      mesh.setColorAt(idx, _color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.instanceId !== undefined) setHoveredIndex(e.instanceId)
  }
  const handlePointerOut = () => setHoveredIndex(null)

  const labelsToShow = useMemo(() => {
    const labels: Array<{ key: string; position: [number, number, number]; name: string; color: string; fontSize: number }> = []
    for (let i = 0; i < nodeData.length; i++) {
      const node = nodeData[i]
      const isActive = activeNodeIds.has(node.id)
      if (node.isRoot || node.depth === 1 || isActive || i === hoveredIndex) {
        labels.push({
          key: node.id,
          position: [node.position[0], node.position[1] + node.size + 0.52, node.position[2]],
          name: node.name,
          color: `#${node.style.label.getHexString()}`,
          fontSize: node.isRoot ? 0.7 : 0.34,
        })
      }
    }
    return labels
  }, [nodeData, activeNodeIds, hoveredIndex])

  const activeNodes = useMemo(() => {
    return nodeData.filter((n) => activeNodeIds.has(n.id))
  }, [nodeData, activeNodeIds])

  if (nodeData.length === 0) return null

  return (
    <group>
      {/* Thin per-branch edge lines */}
      {edgeLines.map((el, i) => (
        <lineSegments key={`edge-${i}`} geometry={el.geometry}>
          <lineBasicMaterial
            color={el.color}
            transparent
            opacity={0.45}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      ))}

      {/* Ring billboard nodes */}
      <instancedMesh
        ref={ringRef}
        args={[nodeGeometry, ringMaterial, nodeData.length]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

      {activeNodes.map((node) => (
        <group key={`scan-${node.id}`} position={node.position}>
          <ScanSweep color={`#${node.style.active.getHexString()}`} />
        </group>
      ))}

      {labelsToShow.map((label) => (
        <Billboard key={label.key} position={label.position}>
          <Text
            fontSize={label.fontSize}
            color={label.color}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.045}
            outlineColor="#000000"
          >
            {label.name.toUpperCase()}
          </Text>
        </Billboard>
      ))}
    </group>
  )
}
