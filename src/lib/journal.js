/** The journal — the user's record of their participation in a conference
 *  (SPEC sect. 5). Pure functions only; persistence lives in storage.js.
 *
 *  Three zones, three owners:
 *    profile — app-owned, structured
 *    picks   — app-owned, the core
 *    x       — user/extension-owned. Never validated, never deleted, NEVER shared.
 */

export const JOURNAL_SCHEMA_VERSION = 1

/** Fields whose change is worth telling the user about. */
const TRACKED = ['title', 'start', 'end', 'location']

export function newJournal(conferenceId, senderName = 'Me') {
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    conferenceId,
    sender: { id: newSenderId(), name: senderName },
    profile: { accessTier: null },
    picks: [],
    x: {},
    meta: { updatedAt: new Date().toISOString() },
  }
}

function newSenderId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `sender-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

/** The snapshot is a CHANGE DETECTOR, never a render source (SPEC sect. 5.2). */
export function makeSnapshot(session, dataVersion) {
  return {
    title: session.title,
    start: session.start,
    end: session.end,
    room: session.location ?? '',
    dataVersion,
  }
}

export function addPick(journal, session, dataVersion) {
  if (journal.picks.some((p) => p.id === session.id)) return journal
  return touch({
    ...journal,
    picks: [
      ...journal.picks,
      {
        id: session.id,
        snapshot: makeSnapshot(session, dataVersion),
        addedAt: new Date().toISOString(),
        notes: '',
        rating: null,
        tags: [],
      },
    ],
  })
}

export function removePick(journal, sessionId) {
  return touch({ ...journal, picks: journal.picks.filter((p) => p.id !== sessionId) })
}

export function updatePick(journal, sessionId, patch) {
  return touch({
    ...journal,
    picks: journal.picks.map((p) => (p.id === sessionId ? { ...p, ...patch } : p)),
  })
}

export function setAccessTier(journal, tier) {
  return touch({ ...journal, profile: { ...journal.profile, accessTier: tier } })
}

function touch(journal) {
  return { ...journal, meta: { ...journal.meta, updatedAt: new Date().toISOString() } }
}

/**
 * Compare each pick's snapshot against current data.
 *
 * -> [{ id, pick, session, kind, changes }]
 *    kind: 'changed' | 'gone'
 *
 * Nothing is ever auto-removed. A pick whose session vanished is reported as
 * 'gone' so the UI can show it, because silently dropping it on a show floor
 * is how people miss talks (SPEC sect. 1.5).
 */
export function detectChanges(journal, sessionsById) {
  const results = []
  for (const pick of journal.picks) {
    const session = sessionsById.get(pick.id)
    if (!session) {
      results.push({ id: pick.id, pick, session: null, kind: 'gone', changes: [] })
      continue
    }
    const current = makeSnapshot(session, null)
    const changes = TRACKED.filter((field) => pick.snapshot?.[key(field)] !== current[key(field)])
      .map((field) => ({
        field,
        from: pick.snapshot?.[key(field)] ?? null,
        to: current[key(field)],
      }))
    if (changes.length) {
      results.push({ id: pick.id, pick, session, kind: 'changed', changes })
    }
  }
  return results
}

// `location` is stored as `room` in the snapshot.
function key(field) {
  return field === 'location' ? 'room' : field
}

/**
 * Acknowledging a change overwrites the snapshot so it stops re-flagging.
 * Without this step every stale pick nags forever (SPEC sect. 5.2).
 */
export function acknowledgeChange(journal, sessionId, session, dataVersion) {
  return updatePick(journal, sessionId, { snapshot: makeSnapshot(session, dataVersion) })
}

export function acknowledgeAll(journal, changes, dataVersion) {
  let next = journal
  for (const change of changes) {
    if (change.session) next = acknowledgeChange(next, change.id, change.session, dataVersion)
  }
  return next
}

/** Can this attendee's badge get them into this session? */
export function canAttend(session, tier, accessLevels) {
  if (!tier || !session.access?.length || !accessLevels?.length) return true
  return session.access.includes(tier)
}
