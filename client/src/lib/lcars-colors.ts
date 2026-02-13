export const LCARS = {
  orange: '#FF9900',
  peach: '#FF9966',
  salmon: '#CC6666',
  lavender: '#CC99CC',
  purple: '#9977AA',
  blue: '#6688CC',
  gold: '#FFCC66',
  lightBlue: '#99CCFF',
  activeGreen: '#55FF55',
  alertRed: '#FF3333',
  warningYellow: '#FFFF66',
  dimGrey: '#444444',
  black: '#000000',
  darkPanel: '#1A1A2E',
  textPrimary: '#FF9966',
  textSecondary: '#CC99CC',
  textDim: '#666688',
  textBright: '#FFFFFF',
} as const

// Deep saturated per-branch colors for the 3D radial tree.
// Edge colors are derived by lightening ~20%.
export const BRANCH_PALETTE = [
  '#FF9900', // LCARS orange
  '#33BBFF', // cyan/sky blue
  '#CC44FF', // vivid purple
  '#44DD66', // green
  '#FF4466', // hot pink/red
  '#FFCC00', // bright gold
  '#FF6633', // tangerine
  '#88BBFF', // periwinkle
]

// Map agent status -> LCARS color
export const STATUS_COLORS: Record<string, string> = {
  idle: LCARS.dimGrey,
  reading: LCARS.blue,
  writing: LCARS.activeGreen,
  executing: LCARS.orange,
}

// Map agent status -> LCARS emissive intensity for 3D
export const STATUS_EMISSIVE: Record<string, number> = {
  idle: 0.2,
  reading: 0.8,
  writing: 1.0,
  executing: 1.2,
}

// Log entry type -> LCARS pill color
export const LOG_TYPE_COLORS: Record<string, string> = {
  READING: LCARS.blue,
  WRITING: LCARS.activeGreen,
  EXECUTING: LCARS.orange,
  IDLE: LCARS.dimGrey,
  CONNECTED: LCARS.lightBlue,
  DISCONNECTED: LCARS.alertRed,
}
