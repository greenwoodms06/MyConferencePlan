import { useMemo, useRef, useState } from 'react'
import { formatRange, formatTime, fromMinutes, toMinutes } from '../lib/time.js'
import { assignLanes } from '../lib/overlap.js'
import { personColor, trackColor, PERSON_COLORS } from '../lib/palette.js'

const PX_PER_MIN = 1.5
const MIN_BLOCK_PX = 30
// A lane narrower than this renders titles as unreadable slivers. Columns grow
// (and the row scrolls) rather than squeezing overlapping picks together.
const MIN_LANE_PX = 96

/**
 * The collaborative view (SPEC sect. 9.2).
 *
 * Default is a PROPORTIONAL time axis: the stated purpose is seeing overlaps
 * and gaps, and a compact list cannot answer that — rows stop aligning across
 * columns. Compact is the escape hatch, not the default.
 *
 * My column is pinned leftmost and non-reorderable: it's the comparison anchor.
 * Person is encoded by column POSITION with a faint tint; session cells keep
 * their track colour, so the two dimensions never fight for one channel.
 */
export default function ColumnsView({
  config, sessionsById, journal, columns, activeDay, setActiveDay,
  conflicts, onColumnsChange, onImportFile, onExportShare,
}) {
  const [compact, setCompact] = useState(false)
  const [editing, setEditing] = useState(null)
  const fileInput = useRef(null)

  const mine = useMemo(() => ({
    id: '__me__',
    label: journal.sender.name || 'Me',
    color: 'slate',
    isMe: true,
    envelope: 'current',
    entries: journal.picks.map((p) => ({
      id: p.id,
      session: sessionsById.get(p.id) ?? null,
      state: sessionsById.get(p.id) ? 'resolved' : 'unresolvable',
    })),
  }), [journal, sessionsById])

  const ordered = useMemo(
    () => [mine, ...[...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))],
    [mine, columns],
  )

  // Blocks for this day, per column.
  const perColumn = useMemo(() => ordered.map((column) => {
    const entries = column.entries
      .filter((e) => !e.session || e.session.day === activeDay)
      // An unresolvable entry has no day, so it can't be placed on the axis —
      // it's listed under the column instead. Never dropped (SPEC sect. 6.3).
      .map((e) => ({ ...e }))
    const placeable = entries.filter((e) => e.session)
    const lanes = assignLanes(placeable.map((e) => e.session))
    const maxLanes = Math.max(1, ...[...lanes.values()].map((l) => l.lanes))
    return {
      column,
      placed: placeable,
      lanes,
      maxLanes,
      ghosts: entries.filter((e) => !e.session),
    }
  }), [ordered, activeDay])

  // Without counts, a day holding everyone's picks looks identical to an empty
  // one, and the view reads as "nothing here" when the picks are a tab away.
  const dayCounts = useMemo(() => {
    const counts = new Map()
    for (const { entries } of ordered) {
      for (const entry of entries) {
        if (!entry.session) continue
        counts.set(entry.session.day, (counts.get(entry.session.day) ?? 0) + 1)
      }
    }
    return counts
  }, [ordered])

  const bounds = useMemo(() => {
    const all = perColumn.flatMap((c) => c.placed.map((e) => e.session))
    if (!all.length) return null
    const start = Math.min(...all.map((s) => toMinutes(s.start)))
    const end = Math.max(...all.map((s) => toMinutes(s.end)))
    return { start: Math.floor(start / 60) * 60, end: Math.ceil(end / 60) * 60 }
  }, [perColumn])

  const hours = useMemo(() => {
    if (!bounds) return []
    const out = []
    for (let m = bounds.start; m <= bounds.end; m += 60) out.push(m)
    return out
  }, [bounds])

  const move = (columnId, delta) => {
    const others = [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const index = others.findIndex((c) => c.id === columnId)
    const target = index + delta
    if (index < 0 || target < 0 || target >= others.length) return
    const [item] = others.splice(index, 1)
    others.splice(target, 0, item)
    onColumnsChange(others.map((c, i) => ({ ...c, order: i })))
  }

  const removeColumn = (columnId) => {
    onColumnsChange(columns.filter((c) => c.id !== columnId))
    setEditing(null)
  }

  const updateColumn = (columnId, patch) => {
    onColumnsChange(columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)))
  }

  return (
    <>
      <div className="day-tabs" role="tablist">
        {config.days.map((day) => (
          <button key={day.key} role="tab" aria-selected={day.key === activeDay}
            onClick={() => setActiveDay(day.key)}>
            <span className="day-label">{day.label}</span>
            <span className="day-date">{day.date}</span>
            {dayCounts.get(day.key) > 0 && (
              <span className="day-count">{dayCounts.get(day.key)}</span>
            )}
          </button>
        ))}
      </div>

      <div className="columns-toolbar">
        <button onClick={() => fileInput.current?.click()}>Load a schedule…</button>
        <button onClick={() => onExportShare(false)}>Share mine</button>
        <button onClick={() => onExportShare(true)} title="Includes your notes and ratings">
          Share + notes
        </button>
        <label className="compact-toggle">
          <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          Compact
        </label>
        <input
          ref={fileInput} type="file" accept="application/json,.json" hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {!bounds ? (
        <div className="empty-state">
          <p>Nothing selected for this day yet.</p>
          <p className="muted">
            {dayCounts.size > 0
              ? 'There are picks on other days — check the tabs above.'
              : 'Pick sessions in Browse, or load a colleague’s schedule to compare.'}
          </p>
        </div>
      ) : compact ? (
        <CompactColumns perColumn={perColumn} config={config} conflicts={conflicts}
          onEdit={setEditing} />
      ) : (
        <div className="timeline">
          <div className="timeline-gutter" style={{ height: (bounds.end - bounds.start) * PX_PER_MIN }}>
            {hours.map((m) => (
              <div key={m} className="hour-mark" style={{ top: (m - bounds.start) * PX_PER_MIN }}>
                <span>{formatTime(fromMinutes(m))}</span>
              </div>
            ))}
          </div>

          <div className="timeline-columns">
            {perColumn.map(({ column, placed, lanes, maxLanes, ghosts }, index) => (
              <section
                key={column.id}
                className={`timeline-column ${column.isMe ? 'is-me' : ''}`}
                style={{
                  '--tint': `hsl(${personColor(column.color).hue} 60% 50% / 0.07)`,
                  minWidth: Math.max(150, maxLanes * MIN_LANE_PX),
                }}
              >
                <header className="column-header">
                  <span className="column-swatch"
                    style={{ background: `hsl(${personColor(column.color).hue} 55% 50%)` }} />
                  <span className="column-name">{column.label}</span>
                  {!column.isMe && (
                    <>
                      <button className="icon-button" onClick={() => move(column.id, -1)}
                        aria-label="Move left" disabled={index <= 1}>‹</button>
                      <button className="icon-button" onClick={() => move(column.id, 1)}
                        aria-label="Move right" disabled={index >= perColumn.length - 1}>›</button>
                      <button className="icon-button" onClick={() => setEditing(column.id)}
                        aria-label="Edit column">⋯</button>
                    </>
                  )}
                </header>

                {column.envelope === 'stale' && (
                  <p className="column-flag" title={`Exported against schedule ${column.dataVersion}`}>
                    May be out of date
                  </p>
                )}

                <div className="column-body" style={{ height: (bounds.end - bounds.start) * PX_PER_MIN }}>
                  {hours.map((m) => (
                    <div key={m} className="hour-line" style={{ top: (m - bounds.start) * PX_PER_MIN }} />
                  ))}

                  {placed.map((entry) => {
                    const s = entry.session
                    const lane = lanes.get(s.id) ?? { lane: 0, lanes: 1 }
                    const top = (toMinutes(s.start) - bounds.start) * PX_PER_MIN
                    const height = Math.max(
                      (toMinutes(s.end) - toMinutes(s.start)) * PX_PER_MIN, MIN_BLOCK_PX,
                    )
                    return (
                      <a
                        key={entry.id}
                        className={`block ${column.isMe && conflicts.has(s.id) ? 'is-conflicted' : ''}`}
                        href={s.url || undefined}
                        target={s.url ? '_blank' : undefined}
                        rel="noreferrer noopener"
                        style={{
                          top, height,
                          left: `${(lane.lane / lane.lanes) * 100}%`,
                          width: `${100 / lane.lanes}%`,
                          '--accent': trackColor(s.tracks[0], config),
                        }}
                        title={`${s.title}\n${formatRange(s)}${s.location ? `\n${s.location}` : ''}`}
                      >
                        <span className="block-time">{formatTime(s.start)}</span>
                        <span className="block-title">{s.title}</span>
                        {s.location && <span className="block-room">{s.location}</span>}
                      </a>
                    )
                  })}
                </div>

                {ghosts.length > 0 && (
                  <div className="ghost-list">
                    <p className="ghost-heading">No longer in the schedule</p>
                    {ghosts.map((g) => (
                      <p key={g.id} className="ghost">{g.id}</p>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <ColumnEditor
          column={columns.find((c) => c.id === editing)}
          onClose={() => setEditing(null)}
          onChange={(patch) => updateColumn(editing, patch)}
          onRemove={() => removeColumn(editing)}
        />
      )}
    </>
  )
}

/** The escape hatch: uniform rows, no dead space, but rows no longer align
 *  across columns — so gaps become unreadable. That's the trade. */
function CompactColumns({ perColumn, config, conflicts, onEdit }) {
  return (
    <div className="compact-columns">
      {perColumn.map(({ column, placed, ghosts }) => (
        <section key={column.id} className={`compact-column ${column.isMe ? 'is-me' : ''}`}
          style={{ '--tint': `hsl(${personColor(column.color).hue} 60% 50% / 0.07)` }}>
          <header className="column-header">
            <span className="column-swatch"
              style={{ background: `hsl(${personColor(column.color).hue} 55% 50%)` }} />
            <span className="column-name">{column.label}</span>
            {!column.isMe && (
              <button className="icon-button" onClick={() => onEdit(column.id)}
                aria-label="Edit column">⋯</button>
            )}
          </header>
          {column.envelope === 'stale' && <p className="column-flag">May be out of date</p>}
          <ul>
            {[...placed]
              .sort((a, b) => toMinutes(a.session.start) - toMinutes(b.session.start))
              .map((entry) => (
                <li key={entry.id}
                  className={column.isMe && conflicts.has(entry.session.id) ? 'is-conflicted' : ''}
                  style={{ '--accent': trackColor(entry.session.tracks[0], config) }}>
                  <span className="compact-time">{formatTime(entry.session.start)}</span>
                  <span className="compact-title">{entry.session.title}</span>
                </li>
              ))}
            {ghosts.map((g) => (
              <li key={g.id} className="ghost"><span className="compact-title">{g.id} — no longer in schedule</span></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ColumnEditor({ column, onClose, onChange, onRemove }) {
  if (!column) return null
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Edit column</h2>
        <label>
          Name
          <input value={column.label}
            onChange={(e) => onChange({ label: e.target.value })} />
        </label>
        <fieldset className="color-picker">
          <legend>Colour</legend>
          {PERSON_COLORS.map((c) => (
            <button key={c.id} className={column.color === c.id ? 'is-selected' : ''}
              style={{ background: `hsl(${c.hue} 55% 50%)` }}
              onClick={() => onChange({ color: c.id })} aria-label={c.label} />
          ))}
        </fieldset>
        <p className="muted">
          The name and colour are yours — they stay put if this person sends an update.
        </p>
        <div className="dialog-actions">
          <button className="danger" onClick={onRemove}>Remove column</button>
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
