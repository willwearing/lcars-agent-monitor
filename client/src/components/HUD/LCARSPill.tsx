interface LCARSPillProps {
  label: string
  color: string
}

export function LCARSPill({ label, color }: LCARSPillProps) {
  return (
    <span className="lcars-pill" style={{ backgroundColor: color }}>
      {label}
    </span>
  )
}
