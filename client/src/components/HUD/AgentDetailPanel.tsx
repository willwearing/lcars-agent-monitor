import { useStore } from '../../store'
import { LCARS, STATUS_COLORS, LOG_TYPE_COLORS } from '../../lib/lcars-colors'
import { formatStardate, formatElapsed } from '../../lib/stardate'
import { LCARSPill } from './LCARSPill'
import { TypewriterText } from './TypewriterText'
import { useRef, useEffect } from 'react'

export function AgentDetailPanel() {
  const selectedAgentId = useStore((s) => s.selectedAgentId)
  const agents = useStore((s) => s.agents)
  const selectedProviders = useStore((s) => s.selectedProviders)
  const log = useStore((s) => s.log)
  const selectAgent = useStore((s) => s.selectAgent)
  const scrollRef = useRef<HTMLDivElement>(null)
  const visibleAgents = agents.filter((a) => selectedProviders.includes(a.provider))

  const agent = visibleAgents.find((a) => a.id === selectedAgentId)
  const agentLog = log.filter((entry) => entry.agentId === selectedAgentId)

  // Auto-scroll log to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [agentLog.length])

  if (!selectedAgentId || !agent) return null

  const statusColor = STATUS_COLORS[agent.status] ?? LCARS.dimGrey
  const now = Date.now()
  const timeSinceActivity = now - agent.lastActivity

  return (
    <div className="lcars-detail-panel">
      <div className="lcars-detail-header">
        <div className="lcars-detail-header-elbow" />
        <div className="lcars-detail-title">
          <span>{agent.name}</span>
          <LCARSPill label={agent.status} color={statusColor} />
          <LCARSPill label={agent.provider.toUpperCase()} color={agent.provider === 'codex' ? LCARS.lightBlue : LCARS.lavender} />
        </div>
        <button
          onClick={() => selectAgent(null)}
          className="lcars-detail-close"
        >
          CLOSE
        </button>
      </div>

      <div className="lcars-detail-meta">
        <div className="lcars-meta-block">
          <span className="lcars-readout-label">DESIGNATION</span>
          <div className="lcars-readout">{agent.id}</div>
        </div>
        <div className="lcars-meta-block">
          <span className="lcars-readout-label">SESSION</span>
          <div className="lcars-readout">{agent.stableSessionId}</div>
        </div>
        <div className="lcars-meta-block">
          <span className="lcars-readout-label">CLASSIFICATION</span>
          <div className="lcars-readout">{agent.type === 'main' ? 'PRIMARY VESSEL' : 'AUXILIARY CRAFT'}</div>
        </div>
        <div className="lcars-meta-block">
          <span className="lcars-readout-label">CURRENT TARGET</span>
          <div className="lcars-readout lcars-target-readout">
            {agent.currentFile ? (
              <TypewriterText text={agent.currentFile} speed={15} />
            ) : (
              <span style={{ color: LCARS.dimGrey }}>NO TARGET LOCK</span>
            )}
          </div>
        </div>
        <div className="lcars-meta-row">
          <div>
            <span className="lcars-readout-label">LAST SIGNAL</span>
            <div className="lcars-readout">{formatElapsed(timeSinceActivity)} AGO</div>
          </div>
          <div>
            <span className="lcars-readout-label">STARDATE</span>
            <div className="lcars-readout">{formatStardate(agent.lastActivity)}</div>
          </div>
        </div>
      </div>

      <div className="lcars-detail-log-header">
        SHIP'S LOG -- {agentLog.length} ENTRIES
      </div>

      <div
        ref={scrollRef}
        className="lcars-scroll"
        style={{ flex: 1 }}
      >
        {agentLog.length === 0 ? (
          <div className="lcars-no-log">
            NO LOG ENTRIES RECORDED
          </div>
        ) : (
          agentLog.slice(-100).map((entry) => (
            <div key={entry.id} className="lcars-log-row">
              <span className="lcars-log-time">
                {formatStardate(entry.timestamp)}
              </span>
              <LCARSPill
                label={entry.type}
                color={LOG_TYPE_COLORS[entry.type] ?? LCARS.dimGrey}
              />
              <span className="lcars-log-message">
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="lcars-detail-footer">
        <div className="lcars-footer-status">
          <div
            className={agent.status !== 'idle' ? 'lcars-status-dot lcars-pulse' : 'lcars-status-dot'}
            style={{ background: statusColor }}
          />
          <span className="lcars-readout-label">{agent.status}</span>
        </div>
        <span className="lcars-readout lcars-footer-clock">
          {formatElapsed(timeSinceActivity)}
        </span>
      </div>
    </div>
  )
}
