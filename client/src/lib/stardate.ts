export function toStardate(unixMs: number): number {
  const date = new Date(unixMs)
  const year = date.getFullYear()
  const startOfYear = new Date(year, 0, 1).getTime()
  const endOfYear = new Date(year + 1, 0, 1).getTime()
  const yearFraction = (unixMs - startOfYear) / (endOfYear - startOfYear)
  const stardate = (year - 2000) * 1000 + yearFraction * 1000
  return Math.round(stardate * 10) / 10
}

export function formatStardate(unixMs: number): string {
  return `SD ${toStardate(unixMs).toFixed(1)}`
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}
