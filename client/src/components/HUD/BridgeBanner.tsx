import { useStore } from '../../store'
import { LCARS } from '../../lib/lcars-colors'
import { formatStardate, formatElapsed } from '../../lib/stardate'
import { AgentChip } from './AgentChip'

export function BridgeBanner() {
  const agents = useStore((s) => s.agents)
  const providers = useStore((s) => s.providers)
  const selectedProviders = useStore((s) => s.selectedProviders)
  const toggleProvider = useStore((s) => s.toggleProvider)
  const setAllProviders = useStore((s) => s.setAllProviders)
  const connected = useStore((s) => s.connected)
  const root = useStore((s) => s.root)
  const missionStartedAt = useStore((s) => s.missionStartedAt)
  const visibleAgents = agents.filter((agent) => selectedProviders.includes(agent.provider))

  const now = Date.now()
  const elapsed = now - missionStartedAt

  const statusCounts = { idle: 0, reading: 0, writing: 0, executing: 0 }
  for (const agent of visibleAgents) {
    statusCounts[agent.status]++
  }

  return (
    <div className="lcars-banner-wrap">
      <div className="lcars-header">
        <div className="lcars-header-sweep-left" />

        <div
          className="lcars-header-segment lcars-header-status"
          style={{
            background: connected ? LCARS.activeGreen : LCARS.alertRed,
            color: LCARS.black,
          }}
        >
          {connected ? 'LINKED' : 'NO LINK'}
        </div>

        <div className="lcars-header-segment lcars-header-code">OPS-47A</div>

        <div className="lcars-header-segment lcars-header-root">
          <span className="lcars-readout lcars-root-readout">
            {root || 'Start working with agents in a project'}
          </span>
        </div>

        <div className="lcars-header-segment lcars-header-clock">
          <span className="lcars-readout">{formatStardate(now)}</span>
          <span className="lcars-readout lcars-clock-elapsed">{formatElapsed(elapsed)}</span>
        </div>

        <div className="lcars-header-segment lcars-header-fleet">
          {statusCounts.reading > 0 && <AgentChip status="reading" count={statusCounts.reading} label="SCANNING" />}
          {statusCounts.writing > 0 && <AgentChip status="writing" count={statusCounts.writing} label="WRITING" />}
          {statusCounts.executing > 0 && <AgentChip status="executing" count={statusCounts.executing} label="EXECUTING" />}
          {statusCounts.idle > 0 && <AgentChip status="idle" count={statusCounts.idle} label="STANDBY" />}
          {visibleAgents.length === 0 && (
            <span className="lcars-empty-fleet">
              NO VESSELS
            </span>
          )}
        </div>

        <div className="lcars-header-segment lcars-provider-strip">
          {(['claude', 'codex'] as const).map((provider) => {
            const health = providers.find((p) => p.provider === provider)?.status ?? 'offline'
            const active = selectedProviders.includes(provider)
            return (
              <button
                key={provider}
                type="button"
                className={active ? 'lcars-provider-chip active' : 'lcars-provider-chip'}
                data-health={health}
                onClick={() => toggleProvider(provider)}
              >
                {provider}
              </button>
            )
          })}
          <button type="button" className="lcars-provider-chip reset" onClick={setAllProviders}>
            ALL
          </button>
        </div>

        <div className="lcars-header-sweep-right" />
      </div>
    </div>
  )
}
