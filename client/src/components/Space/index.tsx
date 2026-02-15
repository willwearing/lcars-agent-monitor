import { useRef, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { StarField } from './StarField'
import { Nebula } from './Nebula'
import { SystemMap } from './SystemMap'
import { AgentFleet } from './AgentFleet'
import { CameraController } from './CameraController'
import { useStore } from '../../store'

function SpaceContent() {
  const controlsRef = useRef(null)
  const setOrbitControlsRef = useStore((s) => s.setOrbitControlsRef)
  const autoPanResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setOrbitControlsRef(controlsRef)
    return () => {
      if (autoPanResumeRef.current) clearTimeout(autoPanResumeRef.current)
    }
  }, [setOrbitControlsRef])

  const handleOrbitStart = useCallback(() => {
    const state = useStore.getState()
    if (state.autoPanEnabled) {
      state.toggleAutoPan()
    }
  }, [])

  const handleOrbitEnd = useCallback(() => {
    const state = useStore.getState()
    if (autoPanResumeRef.current) clearTimeout(autoPanResumeRef.current)
    autoPanResumeRef.current = setTimeout(() => {
      const latest = useStore.getState()
      if (!latest.autoPanEnabled) {
        latest.toggleAutoPan()
      }
    }, 800)
  }, [])

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 40, 60]} fov={50} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={200}
        maxPolarAngle={Math.PI * 0.85}
        onStart={handleOrbitStart}
        onEnd={handleOrbitEnd}
      />
      <ambientLight intensity={0.15} />
      <directionalLight position={[20, 30, 10]} intensity={0.3} color="#66aaff" />
      <pointLight position={[0, 0, 0]} intensity={2} color="#00d4ff" distance={50} />

      <Nebula />
      <StarField />

      <SystemMap />
      <AgentFleet />
      <CameraController controlsRef={controlsRef} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={0.8}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>
    </>
  )
}

export function SpaceScene() {
  return (
    <div style={{ width: '100%', height: '100%' }} data-testid="space-scene">
      <Canvas gl={{ antialias: true, alpha: false }} style={{ background: '#0a0a12' }}>
        <SpaceContent />
      </Canvas>
    </div>
  )
}
