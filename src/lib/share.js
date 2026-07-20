/** Share file: export and import (SPEC sect. 6).
 *
 *  The share file carries BARE IDS, never denormalised titles or times. The
 *  recipient renders from THEIR sessions.json, so retitles and room changes
 *  resolve themselves. A sender's snapshot would be a stale view of the world
 *  presented as fact.
 */

export const SHARE_SCHEMA_VERSION = 1

/**
 * @param journal  the sender's journal for one conference
 * @param options  { includeAnnotations: boolean }  — opt-in, default off
 */
export function buildShareFile(journal, config, options = {}) {
  const { includeAnnotations = false } = options

  const share = {
    schemaVersion: SHARE_SCHEMA_VERSION,
    conferenceId: journal.conferenceId,
    dataVersion: config.dataVersion,
    sender: { id: journal.sender.id, name: journal.sender.name },
    picks: journal.picks.map((p) => p.id),
  }

  if (includeAnnotations) {
    const annotations = {}
    for (const pick of journal.picks) {
      const entry = {}
      if (pick.notes) entry.notes = pick.notes
      if (pick.rating != null) entry.rating = pick.rating
      if (pick.tags?.length) entry.tags = pick.tags
      if (Object.keys(entry).length) annotations[pick.id] = entry
    }
    if (Object.keys(annotations).length) share.annotations = annotations
  }

  // NOTE: journal.x is deliberately never included. Not opt-in, not offered —
  // hotel and flight details must not leave the device (SPEC sect. 6.2).
  return share
}

/** Build an id -> session lookup that also honours retired aliases. */
export function buildResolver(sessions) {
  const byId = new Map()
  for (const session of sessions) {
    byId.set(session.id, session)
    for (const alias of session.aliases ?? []) {
      if (!byId.has(alias)) byId.set(alias, session)
    }
  }
  return byId
}

/**
 * Resolve an imported share file against the local data.
 *
 * Returns THREE states, not two (SPEC sect. 6.3). Never silently drop an
 * unresolvable pick: an empty slot reads as "they're free, go find them",
 * and the one thing we know is that they planned to be busy.
 */
export function resolveShareFile(share, { sessions, config }) {
  const problems = []

  if (share?.schemaVersion !== SHARE_SCHEMA_VERSION) {
    problems.push({
      kind: 'schema-mismatch',
      message: `This file uses share format v${share?.schemaVersion ?? '?'}; this app reads v${SHARE_SCHEMA_VERSION}.`,
    })
  }

  if (share?.conferenceId !== config.conferenceId) {
    return {
      ok: false,
      envelope: 'unknown-conference',
      problems: [
        ...problems,
        {
          kind: 'unknown-conference',
          message: `This file is for "${share?.conferenceId ?? 'an unknown conference'}", but "${config.conferenceId}" is loaded.`,
        },
      ],
      entries: [],
    }
  }

  const resolver = buildResolver(sessions)
  const entries = (share.picks ?? []).map((id) => {
    const session = resolver.get(id) ?? null
    return {
      id,
      session,
      // 'unresolvable' covers both cancelled and renamed-beyond-alias. The
      // envelope's dataVersion is what tells the two apart.
      state: session ? 'resolved' : 'unresolvable',
      annotation: share.annotations?.[id] ?? null,
    }
  })

  const stale = Boolean(share.dataVersion && config.dataVersion && share.dataVersion < config.dataVersion)
  if (stale) {
    problems.push({
      kind: 'stale',
      message: `Exported against schedule ${share.dataVersion}; you have ${config.dataVersion}.`,
    })
  }

  return {
    ok: true,
    envelope: stale ? 'stale' : 'current',
    sender: share.sender ?? { id: 'unknown', name: 'Unknown' },
    dataVersion: share.dataVersion ?? null,
    problems,
    entries,
    unresolvedCount: entries.filter((e) => e.state === 'unresolvable').length,
  }
}

/**
 * Decide whether an incoming share file updates an existing column.
 * `sender.id` is minted once per person and persisted, so a re-export
 * auto-matches — the prompt becomes a confirmation, not a quiz (SPEC sect. 6.4).
 */
export function matchExistingColumn(share, columns) {
  const bySenderId = columns.find((c) => c.sender?.id && c.sender.id === share.sender?.id)
  if (bySenderId) return { column: bySenderId, confidence: 'exact' }

  const byName = columns.find(
    (c) => c.sender?.name && share.sender?.name &&
      c.sender.name.toLowerCase() === share.sender.name.toLowerCase(),
  )
  if (byName) return { column: byName, confidence: 'name' }

  return { column: null, confidence: 'none' }
}

/**
 * Overwrite replaces the pick set and annotations. It NEVER touches label,
 * colour or position — their data is theirs, my presentation of it is mine
 * (SPEC sect. 6.4).
 */
export function applyOverwrite(column, resolved) {
  return {
    ...column,
    sender: resolved.sender,
    dataVersion: resolved.dataVersion,
    envelope: resolved.envelope,
    entries: resolved.entries,
    // label, color and order deliberately preserved from `column`.
  }
}
