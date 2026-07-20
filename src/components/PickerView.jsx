import { useMemo, useState } from 'react'
import SessionCard from './SessionCard.jsx'
import { toMinutes } from '../lib/time.js'
import { canAttend } from '../lib/journal.js'

/**
 * The browse view. Vertical, time-ordered, one day at a time.
 *
 * Filters are DERIVED FROM THE DATA, not declared in config (SPEC sect. 9.1) —
 * a cross-listed session appears under every track it belongs to, which is
 * correct rather than a duplicate.
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
  const [hideRestricted, setHideRestricted] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const tier = journal.profile.accessTier
  const notes = useMemo(
    () => new Map(journal.picks.map((p) => [p.id, p.notes])),
    [journal],
  )

  const dayCounts = useMemo(() => {
    const counts = new Map()
    for (const id of pickedIds) {
      const session = sessions.find((s) => s.id === id)
      if (session) counts.set(session.day, (counts.get(session.day) ?? 0) + 1)
    }
    return counts
  }, [pickedIds, sessions])

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
        if (hideRestricted && !canAttend(s, tier, config.accessLevels)) return false
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
  }, [daySessions, query, include, exclude, tagInclude, onlyPicked, hideRestricted, pickedIds, tier, config])

  const cycleTrack = (track) => {
    // none -> include -> exclude -> none
    if (include.has(track)) {
      setInclude(without(include, track))
      setExclude(with_(exclude, track))
    } else if (exclude.has(track)) {
      setExclude(without(exclude, track))
    } else {
      setInclude(with_(include, track))
    }
  }

  const activeFilters =
    include.size + exclude.size + tagInclude.size + (onlyPicked ? 1 : 0) + (hideRestricted ? 1 : 0)

  const clearAll = () => {
    setInclude(new Set()); setExclude(new Set()); setTagInclude(new Set())
    setOnlyPicked(false); setHideRestricted(false)
  }

  return (
    <>
      <div className="day-tabs" role="tablist">
        {config.days.map((day) => (
          <button
            key={day.key}
            role="tab"
            aria-selected={day.key === activeDay}
            onClick={() => setActiveDay(day.key)}
          >
            <span className="day-label">{day.label}</span>
            <span className="day-date">{day.date}</span>
            {dayCounts.get(day.key) > 0 && (
              <span className="day-count">{dayCounts.get(day.key)}</span>
            )}
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
        <button
          className={activeFilters ? 'is-active' : ''}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          Filters{activeFilters > 0 && ` (${activeFilters})`}
        </button>
      </div>

      {filtersOpen && (
        <div className="filter-panel">
          <div className="filter-toggles">
            <label>
              <input type="checkbox" checked={onlyPicked}
                onChange={(e) => setOnlyPicked(e.target.checked)} />
              Only my picks
            </label>
            {tier && (
              <label>
                <input type="checkbox" checked={hideRestricted}
                  onChange={(e) => setHideRestricted(e.target.checked)} />
                Hide sessions my badge can’t attend
              </label>
            )}
          </div>

          <p className="filter-hint">
            Tap a track to include, tap again to exclude, once more to clear.
          </p>
          <div className="filter-chips">
            {tracks.map(([track, count]) => (
              <button
                key={track}
                className={[
                  'filter-chip',
                  include.has(track) && 'is-include',
                  exclude.has(track) && 'is-exclude',
                ].filter(Boolean).join(' ')}
                onClick={() => cycleTrack(track)}
              >
                {track} <span className="filter-count">{count}</span>
              </button>
            ))}
          </div>

          {tags.length > 0 && (
            <>
              <p className="filter-hint">
                Topics — seeded from titles, so coverage is partial.
              </p>
              <div className="filter-chips">
                {tags.map(([tag, count]) => (
                  <button
                    key={tag}
                    className={`filter-chip ${tagInclude.has(tag) ? 'is-include' : ''}`}
                    onClick={() => setTagInclude(
                      tagInclude.has(tag) ? without(tagInclude, tag) : with_(tagInclude, tag),
                    )}
                  >
                    {tag} <span className="filter-count">{count}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeFilters > 0 && (
            <button className="link-button" onClick={clearAll}>Clear all filters</button>
          )}
        </div>
      )}

      <p className="result-count">
        {visible.length} of {daySessions.length} sessions
      </p>

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>Nothing matches these filters on this day.</p>
          <button className="link-button" onClick={() => { setQuery(''); clearAll() }}>
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="session-list">
          {visible.map((session) => (
            <li key={session.id}>
              <SessionCard
                session={session}
                config={config}
                picked={pickedIds.has(session.id)}
                conflicted={conflicts.has(session.id)}
                tier={tier}
                onToggle={onTogglePick}
                note={notes.get(session.id)}
                onNote={(id, value) => onUpdatePick(id, { notes: value })}
              />
            </li>
          ))}
        </ul>
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

function with_(set, value) {
  const next = new Set(set)
  next.add(value)
  return next
}

function without(set, value) {
  const next = new Set(set)
  next.delete(value)
  return next
}
