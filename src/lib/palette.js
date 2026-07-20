/** Colour assignment.
 *
 *  Two independent semantic dimensions must not compete for the same visual
 *  channel (SPEC sect. 9.2): TRACK is encoded as the cell's accent colour;
 *  PERSON is encoded by column position, with a faint column tint as secondary.
 *  So these are two separate palettes and person tints are deliberately weak.
 */

// Track accents. Conference config may override per track; anything undeclared
// falls back to a stable hash so colours don't shuffle between sessions.
const TRACK_FALLBACK = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0d9488',
  '#4f46e5', '#c026d3', '#dc2626', '#65a30d', '#0891b2',
  '#9333ea', '#e11d48', '#047857', '#b45309', '#0369a1',
]

function hash(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function trackColor(track, config) {
  const declared = config?.tracks?.find((t) => t.id === track)
  if (declared?.color) return declared.color
  return TRACK_FALLBACK[hash(track ?? '') % TRACK_FALLBACK.length]
}

/** Person tints — receiver-assigned, low saturation so they never read as tracks. */
export const PERSON_COLORS = [
  { id: 'slate',  label: 'Slate',  hue: 215 },
  { id: 'violet', label: 'Violet', hue: 265 },
  { id: 'rose',   label: 'Rose',   hue: 340 },
  { id: 'amber',  label: 'Amber',  hue: 35 },
  { id: 'teal',   label: 'Teal',   hue: 175 },
  { id: 'lime',   label: 'Lime',   hue: 90 },
]

export function personColor(id) {
  return PERSON_COLORS.find((c) => c.id === id) ?? PERSON_COLORS[0]
}

/** Pick the first colour not already taken by another column. */
export function nextPersonColor(taken) {
  const used = new Set(taken)
  return (PERSON_COLORS.find((c) => !used.has(c.id)) ?? PERSON_COLORS[0]).id
}
