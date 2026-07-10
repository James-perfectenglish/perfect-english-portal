// Shared constants + helpers for the teacher preview controls (sidebar).
// Three independent controls: language (en/es), level band (A/B/C, tap to cycle
// sub-level), and vocational track filters (bathroom/hotels/business, multi-select).

// Level bands, matching the app's LevelBadge colours (A=green, B=blue, C=orange).
export const LEVEL_BANDS = { A: ['A2'], B: ['B1', 'B2'], C: ['C1', 'C2'] }
export const BAND_ORDER = ['A', 'B', 'C']

export const LEVEL_BUTTONS = [
  { band: 'A', emoji: '🟩', label: 'Beginner (A)' },
  { band: 'B', emoji: '🟦', label: 'Intermediate (B)' },
  { band: 'C', emoji: '🟧', label: 'Advanced (C)' },
]

// The vocational track-filter buttons James uses (the ones kept off his normal lists).
export const VOCATIONAL_TRACKS = [
  { key: 'bathroom', emoji: '🛁', label: 'Bathroom' },
  { key: 'hotels',   emoji: '🏨', label: 'Hotels'   },
  { key: 'business', emoji: '💼', label: 'Business' },
]

// Which band a CEFR level belongs to ('B1' -> 'B'). Defaults to 'C'.
export function bandOf(level) {
  const first = (level || 'C')[0]
  return BAND_ORDER.includes(first) ? first : 'C'
}

// Tapping a band button: if we're not on that band, jump to its first level;
// if we're already on it, advance to the next sub-level (wrapping).
export function nextLevelForBand(currentLevel, band) {
  const levels = LEVEL_BANDS[band]
  if (!levels) return currentLevel
  const idx = levels.indexOf(currentLevel)
  if (idx === -1) return levels[0]
  return levels[(idx + 1) % levels.length]
}
