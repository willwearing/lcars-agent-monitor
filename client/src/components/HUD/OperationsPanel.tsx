import { useMemo } from 'react'
import { useStore } from '../../store'
import { STATUS_COLORS, LOG_TYPE_COLORS } from '../../lib/lcars-colors'

const STATUS_LABELS = {
  reading: 'SCANNING',
  writing: 'WRITING',
  executing: 'EXEC',
  idle: 'STANDBY',
} as const

export function OperationsPanel() {
  const agents = useStore((s) => s.agents)
  const selectedProviders = useStore((s) => s.selectedProviders)
  const connected = useStore((s) => s.connected)
  const log = useStore((s) => s.log)
  const visibleAgents = agents.filter((agent) => selectedProviders.includes(agent.provider))

  const counts = useMemo(() => {
    const base = { reading: 0, writing: 0, executing: 0, idle: 0 }
    for (const agent of visibleAgents) base[agent.status]++
    return base
  }, [visibleAgents])

  const providerCounts = useMemo(
    () =>
      visibleAgents.reduce(
        (acc, agent) => {
          acc[agent.provider] += 1
          return acc
        },
        { claude: 0, codex: 0 },
      ),
    [visibleAgents],
  )

  const recentEvents = useMemo(
    () =>
      log
        .filter((entry) => entry.provider === 'system' || selectedProviders.includes(entry.provider))
        .slice(-6)
        .reverse(),
    [log, selectedProviders],
  )

  return (
    <aside className="lcars-ops-panel" aria-label="Operations panel">
      <div className="lcars-ops-header">
        <span>OPS</span>
        <span className={connected ? 'lcars-ops-dot linked' : 'lcars-ops-dot'} />
      </div>

      <div className="lcars-ops-status-grid">
        {(Object.keys(counts) as Array<keyof typeof counts>).map((key) => (
          <div key={key} className="lcars-ops-status-cell">
            <div className="lcars-ops-status-value" style={{ color: STATUS_COLORS[key] }}>
              {counts[key]}
            </div>
            <div className="lcars-ops-status-label">{STATUS_LABELS[key]}</div>
          </div>
        ))}
      </div>

      <div className="lcars-ops-subheader">ACTIVITY FEED</div>
      <div className="lcars-ops-provider-counts">
        <span>CLAUDE {providerCounts.claude}</span>
        <span>CODEX {providerCounts.codex}</span>
      </div>
      <div className="lcars-ops-feed">
        {recentEvents.length === 0 ? (
          <div className="lcars-ops-empty">NO INCOMING TELEMETRY</div>
        ) : (
          recentEvents.map((entry) => (
            <div key={entry.id} className="lcars-ops-feed-row">
              <span className="lcars-ops-feed-tag" style={{ background: LOG_TYPE_COLORS[entry.type] }}>
                {entry.type}
              </span>
              <span className="lcars-ops-feed-msg">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
