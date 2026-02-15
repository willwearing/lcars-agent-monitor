import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'
import { computeAutoPanTarget } from '../../lib/auto-pan-target'
import { findClosestNode } from '../../lib/tree-layout'

const _target = new THREE.Vector3()

// Google Earth-style smooth scrolling: lerp factor adapts to distance.
// Far away = faster initial glide, close up = gentle deceleration.
const MIN_LERP = 0.015   // floor: never slower than this (prevents stalling)
const MAX_LERP = 0.06    // ceiling: never faster than this (prevents jitter)
const DISTANCE_SCALE = 0.8 // how much distance influences speed

interface CameraControllerProps {
  controlsRef: React.RefObject<any>
}

export function CameraController({ controlsRef }: CameraControllerProps) {
  const lastTargetRef = useRef<THREE.Vector3 | null>(null)

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return

    const state = useStore.getState()
    if (!state.autoPanEnabled) {
      lastTargetRef.current = null
      return
    }

    let panTarget: [number, number, number] | null = null

    const visibleAgents = state.agents.filter((a) => state.selectedProviders.includes(a.provider))

    // When only one agent is in view, track that agent's position (even if selected)
    if (visibleAgents.length === 1) {
      const single = visibleAgents[0]
      const filePath = single.currentFile || single.workspace
      if (filePath) {
        const node = findClosestNode(filePath, state.positionedNodes, state.root)
        if (node) {
          panTarget = node.position
        }
      }
    }

    // Fall back to centroid of active agents
    if (!panTarget) {
      panTarget = computeAutoPanTarget(visibleAgents, state.positionedNodes, state.root)
    }

    if (!panTarget) return

    _target.set(panTarget[0], panTarget[1], panTarget[2])

    if (!lastTargetRef.current) {
      // First frame with a target: jump to it
      lastTargetRef.current = _target.clone()
      controls.target.copy(_target)
      return
    }

    // Distance-adaptive lerp: farther = faster glide, closer = gentle deceleration
    const distance = controls.target.distanceTo(_target)
    const adaptiveLerp = Math.min(MAX_LERP, Math.max(MIN_LERP, distance * DISTANCE_SCALE * 0.01))
    controls.target.lerp(_target, adaptiveLerp)
    lastTargetRef.current.copy(controls.target)
  })

  return null
}
