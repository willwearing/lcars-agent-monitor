import { useWebSocket } from './hooks/useWebSocket'
import { useStore } from './store'
import { BridgeBanner } from './components/HUD/BridgeBanner'
import { AgentDetailPanel } from './components/HUD/AgentDetailPanel'
import { OperationsPanel } from './components/HUD/OperationsPanel'
import { Scene3D } from './components/Scene3D'
import './styles/lcars.css'

export default function App() {
  useWebSocket()
  const tree = useStore((s) => s.tree)

  return (
    <div className="lcars-app-shell">
      <div className="lcars-bg-stars" />
      <div className="lcars-bg-grid" />
      <div className="lcars-bg-scanline" />
      <BridgeBanner />
      <div className="lcars-scene-layer">
        {tree ? (
          <Scene3D />
        ) : (
          <div className="lcars-awaiting-signal">
            AWAITING SIGNAL -- START CLAUDE CODE IN A PROJECT DIRECTORY
          </div>
        )}
      </div>
      <OperationsPanel />
      <AgentDetailPanel />
    </div>
  )
}
