import { useMemo } from 'react'
import { useStore } from '../../store'
import { findClosestNode } from '../../lib/tree-layout'
import { AgentVessel } from './AgentVessel'

export function AgentFleet() {
  const agents = useStore((s) => s.agents)
  const selectedProviders = useStore((s) => s.selectedProviders)
  const root = useStore((s) => s.root)
  const selectAgent = useStore((s) => s.selectAgent)
  const positionedNodes = useStore((s) => s.positionedNodes)
  const visibleAgents = agents.filter((a) => selectedProviders.includes(a.provider))

  const agentTargets = useMemo(() => {
    const targets = new Map<string, [number, number, number] | null>()
    for (const agent of visibleAgents) {
      if (agent.currentFile) {
        const node = findClosestNode(agent.currentFile, positionedNodes, root)
        targets.set(agent.id, node?.position ?? null)
      } else {
        targets.set(agent.id, null)
      }
    }
    return targets
  }, [visibleAgents, positionedNodes, root])

  const idleCount = visibleAgents.filter((a) => a.status === 'idle').length

  return (
    <group>
      {visibleAgents.map((agent, i) => (
        <AgentVessel
          key={agent.id}
          agent={agent}
          targetPosition={agentTargets.get(agent.id) ?? null}
          agentIndex={i}
          totalIdleAgents={idleCount}
          onClick={() => selectAgent(agent.id)}
        />
      ))}
    </group>
  )
}
