import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei'
import { TreeGraph3D } from './TreeGraph3D'
import { AgentFleet } from './AgentFleet'

export function Scene3D() {
  return (
    <div style={{ width: '100%', height: '100%' }} data-testid="scene3d">
      <Canvas gl={{ antialias: true, alpha: false }} style={{ background: '#000' }}>
        <PerspectiveCamera makeDefault position={[0, 15, 30]} fov={55} />
        <OrbitControls enableDamping dampingFactor={0.05} minDistance={8} maxDistance={100} maxPolarAngle={Math.PI * 0.85} />
        <ambientLight intensity={0.24} />
        <directionalLight position={[12, 18, 8]} intensity={0.45} color="#99ccff" />
        <directionalLight position={[-10, 8, -12]} intensity={0.25} color="#ffcc66" />
        <Stars radius={150} depth={60} count={3000} factor={4} saturation={0} />
        <TreeGraph3D />
        <AgentFleet />
      </Canvas>
    </div>
  )
}
