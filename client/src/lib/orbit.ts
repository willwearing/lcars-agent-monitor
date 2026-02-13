export function computeAgentOrbit(
  target: [number, number, number],
  agentIndex: number,
  radius: number,
  time: number,
): [number, number, number] {
  const phaseOffset = agentIndex * Math.PI * 0.618
  const tiltAngle = (agentIndex * 0.4) % (Math.PI * 0.5)
  const speed = 0.3 + (agentIndex % 4) * 0.1
  const t = time * speed + phaseOffset

  const x = Math.cos(t) * radius
  const z = Math.sin(t) * radius
  const y = Math.sin(t * 0.5 + phaseOffset) * radius * 0.25

  const cosT = Math.cos(tiltAngle)
  const sinT = Math.sin(tiltAngle)
  const tiltedY = y * cosT - z * sinT
  const tiltedZ = y * sinT + z * cosT

  return [target[0] + x, target[1] + tiltedY, target[2] + tiltedZ]
}

export function computeHoldingPattern(
  agentIndex: number,
  totalAgents: number,
  time: number,
): [number, number, number] {
  const baseAngle = (agentIndex / Math.max(totalAgents, 1)) * Math.PI * 2
  const radius = 12 + Math.sin(time * 0.2 + agentIndex) * 2
  const speed = 0.15
  const t = time * speed + baseAngle

  return [
    Math.cos(t) * radius,
    3 + Math.sin(t * 0.3) * 1.5,
    Math.sin(t) * radius,
  ]
}
