import { useMemo } from 'react'
import { useStore } from '../../store'
import { STATUS_COLORS } from '../../lib/eve-colors'

const STATUS_PRIORITY: Record<string, number> = {
  executing: 0,
  writing: 1,
  reading: 2,
  idle: 3,
}

export function Overview() {
  const agents = useStore((s) => s.agents)
  const selectedProviders = useStore((s) => s.selectedProviders)
  const selectedAgentId = useStore((s) => s.selectedAgentId)
  const selectAgent = useStore((s) => s.selectAgent)

  const visibleAgents = useMemo(() => {
    return agents
      .filter((a) => selectedProviders.includes(a.provider))
      .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9))
  }, [agents, selectedProviders])

  return (
    <aside className="eve-overview" aria-label="Fleet overview">
      <div className="eve-overview-header">FLEET OVERVIEW</div>
      <div className="eve-overview-list">
        {visibleAgents.length === 0 ? (
          <div className="eve-overview-empty">No agents in system</div>
        ) : (
          visibleAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={`eve-overview-row ${agent.id === selectedAgentId ? 'selected' : ''}`}
              onClick={() => selectAgent(agent.id === selectedAgentId ? null : agent.id)}
            >
              <span
                className="eve-overview-status-dot"
                style={{ background: STATUS_COLORS[agent.status] }}
              />
              <span className="eve-overview-name">{agent.name}</span>
              <span className="eve-overview-type">{agent.type === 'subagent' ? 'SUB' : 'MAIN'}</span>
              <span className="eve-overview-target">
                {(agent.currentFile || agent.workspace)?.split('/').pop() || '--'}
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
