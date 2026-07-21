/** Bundle validation — the one place that knows what a valid SessionSamba
 *  bundle looks like. Used at runtime when a user loads someone else's file
 *  (registry.js) and offline by scripts/check_bundle.mjs, so data authors and
 *  the app enforce the same rules.
 */

/** Required on every session — shared with the AI conversion prompt
 *  (src/lib/aiPrompt.js) so the two can't drift. */
export const REQUIRED_SESSION_FIELDS = ['id', 'day', 'start', 'end', 'title', 'tracks']

/**
 * Shape gate: is this object a { config, sessions } bundle at all?
 * -> { ok, config, sessions } or { ok: false, error }
 */
export function validateBundle(raw) {
  const config = raw?.config ?? raw?.conference
  const sessions = raw?.sessions
  if (!config || typeof config !== 'object') return { ok: false, error: 'No "config" object in the file.' }
  if (!config.conferenceId) return { ok: false, error: 'config.conferenceId is missing.' }
  if (!config.name) return { ok: false, error: 'config.name is missing.' }
  if (!Array.isArray(config.days) || config.days.length === 0) return { ok: false, error: 'config.days must be a non-empty array.' }
  if (!Array.isArray(sessions)) return { ok: false, error: 'No "sessions" array in the file.' }
  const bad = sessions.findIndex((s) => !s?.id || !s?.day || !s?.start || !s?.end || !s?.title || !Array.isArray(s?.tracks))
  if (bad !== -1) return { ok: false, error: `Session #${bad + 1} is missing required fields (${REQUIRED_SESSION_FIELDS.join(', ')}).` }
  return { ok: true, config, sessions }
}

const TIME_RE = /^\d{2}:\d{2}$/

/**
 * Deeper spec conformance for a shape-valid bundle (SPEC sect. 3–4).
 * -> array of human-readable issues; empty means clean.
 */
export function checkBundle(config, sessions) {
  const issues = []
  const say = (s, msg) => issues.push(`${s.id ?? '?'}: ${msg}`)

  const dayKeys = new Set((config.days ?? []).map((d) => d.key))
  const tiers = new Set((config.accessLevels ?? []).map((l) => l.id))

  const seen = new Map()
  for (const s of sessions) {
    const prior = seen.get(s.id)
    if (prior) say(s, `duplicate id (also used by "${prior.title}")`)
    seen.set(s.id, s)

    if (!dayKeys.has(s.day)) say(s, `day "${s.day}" is not in config.days`)
    if (!TIME_RE.test(s.start)) say(s, `start "${s.start}" is not 24h HH:MM`)
    if (!TIME_RE.test(s.end)) say(s, `end "${s.end}" is not 24h HH:MM`)
    if (TIME_RE.test(s.start) && TIME_RE.test(s.end) && s.end <= s.start) {
      say(s, `end ${s.end} is not after start ${s.start}`)
    }
    if (!s.tracks.length) say(s, 'tracks is empty — every session needs at least one')
    if (config.accessLevels?.length) {
      for (const a of s.access ?? []) {
        if (!tiers.has(a)) say(s, `access tier "${a}" is not declared in config.accessLevels`)
      }
    }
    if (s.url && !/^https?:\/\//.test(s.url)) say(s, `url is not absolute: ${s.url}`)
    for (const c of s.contributors ?? []) {
      if (c.url && !/^https?:\/\//.test(c.url)) say(s, `contributor url is not absolute: ${c.url}`)
    }
    for (const alias of s.aliases ?? []) {
      const holder = seen.get(alias)
      if (holder && holder !== s) say(s, `alias "${alias}" collides with a live session id`)
    }
  }
  return issues
}
