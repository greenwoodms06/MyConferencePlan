import { useMemo, useState } from 'react'
import SessionCard from './SessionCard.jsx'
import { toMinutes } from '../lib/time.js'
import { trackColor } from '../lib/palette.js'

/**
 * Browse view. Vertical, time-ordered, one day at a time.
 *
 * Filters are DERIVED FROM THE DATA (SPEC §9.1) — a cross-listed session
 * appears under every track it belongs to, which is correct, not a duplicate.
 * Filters live in a bottom sheet (Companion design).
 */
export default function PickerView({
  config, sessions, activeDay, setActiveDay, pickedIds, conflicts,
  journal, onTogglePick, onUpdatePick,
}) {
  const [query, setQuery] = useState('')
  const [include, setInclude] = useState(() => new Set())
  const [exclude, setExclude] = useState(() => new Set())
  const [tagInclude, setTagInclude] = useState(() => new Set())
  const [onlyPicked, setOnlyPicked] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions])
  const pickState = useMemo(
    () => new Map(journal.picks.map((p) => [p.id, p])),
    [journal],
  )

  const dayCounts = useMemo(() => {
    const counts = new Map()
    for (const id of pickedIds) {
      const session = byId.get(id)
      if (session) counts.set(session.day, (counts.get(session.day) ?? 0) + 1)
    }
    return counts
  }, [pickedIds, byId])

  const daySessions = useMemo(
    () => sessions.filter((s) => s.day === activeDay),
    [sessions, activeDay],
  )

  const tracks = useMemo(() => tally(daySessions, (s) => s.tracks), [daySessions])
  const tags = useMemo(() => tally(daySessions, (s) => s.tags ?? []), [daySessions])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return daySessions
      .filter((s) => {
        if (onlyPicked && !pickedIds.has(s.id)) return false
        if (include.size && !s.tracks.some((t) => include.has(t))) return false
        if (exclude.size && s.tracks.some((t) => exclude.has(t))) return false
        if (tagInclude.size && !(s.tags ?? []).some((t) => tagInclude.has(t))) return false
        if (!q) return true
        return (
          s.title.toLowerCase().includes(q) ||
          s.location?.toLowerCase().includes(q) ||
          s.tracks.some((t) => t.toLowerCase().includes(q)) ||
          (s.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
          s.contributors?.some((c) => c.name.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || a.title.localeCompare(b.title))
  }, [daySessions, query, include, exclude, tagInclude, onlyPicked, pickedIds])

  /** Title of the first pick this one overlaps, for the amber chip. */
  const overlapTitle = (id) => {
    const others = conflicts.get(id)
    if (!others) return null
    for (const otherId of others) {
      const s = byId.get(otherId)
      if (s) return s.title
    }
    return null
  }

  const cycleTrack = (track) => {
    if (include.has(track)) { setInclude(without(include, track)); setExclude(with_(exclude, track)) }
    else if (exclude.has(track)) setExclude(without(exclude, track))
    else setInclude(with_(include, track))
  }

  const activeFilters = include.size + exclude.size + tagInclude.size + (onlyPicked ? 1 : 0)
  const clearAll = () => {
    setInclude(new Set()); setExclude(new Set()); setTagInclude(new Set()); setOnlyPicked(false)
  }

  return (
    <>
      <div className="day-tabs" role="tablist">
        {config.days.map((day) => (
          <button key={day.key} role="tab" aria-selected={day.key === activeDay}
            onClick={() => setActiveDay(day.key)}>
            <span className="day-label">{day.label}</span>
            <span className="day-date">{day.date}</span>
            {dayCounts.get(day.key) > 0 && <span className="day-count">{dayCounts.get(day.key)}</span>}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search titles, people, rooms…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search sessions"
        />
        <button className={activeFilters ? 'is-active' : ''} onClick={() => setFiltersOpen(true)}>
          Filters{activeFilters > 0 && ` · ${activeFilters}`}
        </button>
      </div>

      <p className="result-count">{visible.length} of {daySessions.length} sessions</p>

      {visible.length === 0 ? (
        <div className="empty-state">
          No sessions match — clear a filter or two.
          {activeFilters > 0 && (
            <button className="link-button" style={{ display: 'block', margin: '10px auto 0' }}
              onClick={() => { setQuery(''); clearAll() }}>Clear all</button>
          )}
        </div>
      ) : (
        <ul className="session-list">
          {visible.map((session) => {
            const pick = pickState.get(session.id)
            return (
              <li key={session.id}>
                <SessionCard
                  session={session}
                  config={config}
                  picked={pickedIds.has(session.id)}
                  overlapWith={overlapTitle(session.id)}
                  onToggle={onTogglePick}
                  note={pick?.notes}
                  onNote={(id, value) => onUpdatePick(id, { notes: value })}
                  rating={pick?.rating}
                  onRate={(id, value) => onUpdatePick(id, { rating: value })}
                />
              </li>
            )
          })}
        </ul>
      )}

      {filtersOpen && (
        <>
          <div className="scrim" onClick={() => setFiltersOpen(false)} />
          <div className="sheet" role="dialog" aria-label="Filters">
            <div className="sheet-grip" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Filters</h2>
              {activeFilters > 0 && <button className="link-button" onClick={clearAll}>Clear all</button>}
            </div>

            <button className="only-toggle" aria-pressed={onlyPicked}
              onClick={() => setOnlyPicked((v) => !v)}>
              <span className="only-box">{onlyPicked ? '✓' : ''}</span> Only my picks
            </button>

            <p className="filter-hint">Tap a track to include, again to exclude, once more to clear.</p>
            <div className="filter-chips">
              {tracks.map(([track, count]) => (
                <button key={track}
                  className={['filter-chip', include.has(track) && 'is-include', exclude.has(track) && 'is-exclude'].filter(Boolean).join(' ')}
                  style={include.has(track) ? { '--chip': trackColor(track, config) } : undefined}
                  onClick={() => cycleTrack(track)}>
                  {track} <span className="count">{count}</span>
                </button>
              ))}
            </div>

            {tags.length > 0 && (
              <>
                <p className="filter-hint">Topics — seeded from titles, so coverage is partial.</p>
                <div className="filter-chips">
                  {tags.map(([tag, count]) => (
                    <button key={tag}
                      className={`filter-chip ${tagInclude.has(tag) ? 'is-include' : ''}`}
                      onClick={() => setTagInclude(tagInclude.has(tag) ? without(tagInclude, tag) : with_(tagInclude, tag))}>
                      {tag} <span className="count">{count}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}

/** Count distinct values produced by `pick` across sessions, commonest first. */
function tally(sessions, pick) {
  const counts = new Map()
  for (const s of sessions) {
    for (const value of pick(s)) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

const with_ = (set, value) => new Set(set).add(value)
const without = (set, value) => { const n = new Set(set); n.delete(value); return n }
