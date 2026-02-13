import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { STATUS_COLORS, LCARS } from '../../lib/lcars-colors'

interface AgentBeamProps {
  agentStatus: string
  targetPosition: [number, number, number]
  agentGroupRef: React.RefObject<THREE.Group | null>
}

export function AgentBeam({ agentStatus, targetPosition, agentGroupRef }: AgentBeamProps) {
  const { scene } = useThree()
  const lineRef = useRef<THREE.Line | null>(null)
  const color = STATUS_COLORS[agentStatus] ?? LCARS.dimGrey

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(6) // 2 points x 3 coords
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 }),
    [color],
  )

  useEffect(() => {
    if (agentStatus === 'idle') return
    const line = new THREE.Line(geometry, material)
    lineRef.current = line
    scene.add(line)
    return () => {
      scene.remove(line)
      lineRef.current = null
    }
  }, [scene, geometry, material, agentStatus])

  useFrame(() => {
    if (!lineRef.current || !agentGroupRef.current) return
    const positions = geometry.attributes.position as THREE.BufferAttribute
    const agentPos = agentGroupRef.current.position

    positions.setXYZ(0, agentPos.x, agentPos.y, agentPos.z)
    positions.setXYZ(1, targetPosition[0], targetPosition[1], targetPosition[2])
    positions.needsUpdate = true
  })

  return null
}
