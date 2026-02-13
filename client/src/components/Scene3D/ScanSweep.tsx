import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LCARS } from '../../lib/lcars-colors'

interface ScanSweepProps {
  color?: string
  maxRadius?: number
  speed?: number
}

export function ScanSweep({ color = LCARS.gold, maxRadius = 2.5, speed = 1.5 }: ScanSweepProps) {
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const ring3Ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed
    const refs = [ring1Ref, ring2Ref, ring3Ref]

    refs.forEach((ref, i) => {
      if (!ref.current) return
      // Stagger each ring by a third of a cycle
      const phase = (t + i * (Math.PI * 2 / 3)) % (Math.PI * 2)
      const progress = phase / (Math.PI * 2)
      const scale = 0.3 + progress * maxRadius
      ref.current.scale.set(scale, scale, 1)

      // Fade out as ring expands
      const material = ref.current.material as THREE.MeshBasicMaterial
      material.opacity = (1 - progress) * 0.4
    })
  })

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {[ring1Ref, ring2Ref, ring3Ref].map((ref, i) => (
        <mesh key={i} ref={ref}>
          <ringGeometry args={[0.9, 1.0, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
