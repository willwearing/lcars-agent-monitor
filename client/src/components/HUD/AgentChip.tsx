import { STATUS_COLORS } from '../../lib/lcars-colors'

interface AgentChipProps {
  status: string
  count: number
  label: string
}

export function AgentChip({ status, count, label }: AgentChipProps) {
  const color = STATUS_COLORS[status] ?? '#444'
  return (
    <div className="lcars-agent-chip" style={{ background: color }}>
      <span className="lcars-agent-chip-count">{count}</span>
      {label}
    </div>
  )
}
