import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard, Trail } from '@react-three/drei'
import * as THREE from 'three'
import type { Agent } from '../../types'
import { STATUS_COLORS, LCARS } from '../../lib/lcars-colors'
import { computeAgentOrbit } from '../../lib/orbit'

// Pre-allocate reusable vector (zero GC pressure)
const _targetVec = new THREE.Vector3()

interface AgentVesselProps {
  agent: Agent
  targetPosition: [number, number, number] | null
  agentIndex: number
  totalIdleAgents: number
  onClick: () => void
}

export function AgentVessel({ agent, targetPosition, agentIndex, totalIdleAgents, onClick }: AgentVesselProps) {
  const groupRef = useRef<THREE.Group>(null)
  const currentCenter = useRef(new THREE.Vector3(0, 3, 0))
  const color = STATUS_COLORS[agent.status] ?? LCARS.dimGrey

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    // Desired center: target node if active, holding pattern base if idle
    let desiredCenter: [number, number, number]
    if (targetPosition && agent.status !== 'idle') {
      desiredCenter = targetPosition
    } else {
      const baseAngle = (agentIndex / Math.max(totalIdleAgents, 1)) * Math.PI * 2
      const radius = 12
      desiredCenter = [Math.cos(baseAngle) * radius, 3, Math.sin(baseAngle) * radius]
    }

    // Smooth travel toward desired center (reuse vector, no allocation)
    _targetVec.set(desiredCenter[0], desiredCenter[1], desiredCenter[2])
    currentCenter.current.lerp(_targetVec, 0.02)

    // Orbit around the smoothed center
    const center: [number, number, number] = [
      currentCenter.current.x,
      currentCenter.current.y,
      currentCenter.current.z,
    ]
    const pos = computeAgentOrbit(center, agentIndex, 1.8, t)
    groupRef.current.position.set(...pos)
  })

  return (
    <group ref={groupRef}>
      <Trail width={0.2} length={8} color={color} attenuation={(t) => t * t}>
        <mesh onClick={onClick}>
          <coneGeometry args={[0.15, 0.4, 6]} />
          <meshStandardMaterial
            color={color} emissive={color}
            emissiveIntensity={agent.status !== 'idle' ? 2.5 : 0.8}
            roughness={0.2} metalness={0.8}
            toneMapped={false}
          />
        </mesh>
      </Trail>

      <Billboard position={[0, 0.5, 0]}>
        <Text
          fontSize={0.2}
          color={color}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {agent.name.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  )
}
