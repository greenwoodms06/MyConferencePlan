import { useMemo, useRef, useState } from 'react'
import ColumnTimeline from './ColumnTimeline.jsx'
import { personColor, PERSON_COLORS } from '../lib/palette.js'

/**
 * My day (SPEC §9.2) — the shared ColumnTimeline with one column per person.
 * "Me" is pinned leftmost as the comparison anchor; imported columns follow in
 * a receiver-assigned colour. Person is encoded by column + faint tint, never
 * by block colour (blocks keep their track colour).
 */
export default function ColumnsView({
  config, sessionsById, journal, columns, activeDay, setActiveDay,
  conflicts, onColumnsChange, onImportFile, onExportShare, onOpen,
}) {
  const [compact, setCompact] = useState(false)
  const [editing, setEditing] = useState(null)
  const fileInput = useRef(null)

  const mine = useMemo(() => ({
    id: '__me__', label: journal.sender.name || 'Me', isMe: true, envelope: 'current',
    entries: journal.picks.map((p) => ({ id: p.id, session: sessionsById.get(p.id) ?? null })),
  }), [journal, sessionsById])

  const ordered = useMemo(
    () => [mine, ...[...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))],
    [mine, columns],
  )

  const dayCounts = useMemo(() => {
    const counts = new Map()
    for (const col of ordered) {
      for (const e of col.entries) {
        if (e.session) counts.set(e.session.day, (counts.get(e.session.day) ?? 0) + 1)
      }
    }
    return counts
  }, [ordered])

  // Build ColumnTimeline columns for the active day; unresolvable picks have no
  // time so they can't sit on the axis — they're listed below, never dropped.
  const { tlColumns, ghosts, staleColumns } = useMemo(() => {
    const tl = []
    const gh = []
    const stale = []
    ordered.forEach((col, index) => {
      const swatch = col.isMe ? 'var(--accent)' : `hsl(${personColor(col.color).hue} 55% 50%)`
      const tint = col.isMe ? 'var(--accent-tint)' : `hsl(${personColor(col.color).hue} 60% 50% / 0.07)`
      const dayEntries = col.entries.filter((e) => !e.session || e.session.day === activeDay)
      const items = dayEntries.filter((e) => e.session).map((e) => ({
        id: e.session.id, start: e.session.start, end: e.session.end, title: e.session.title,
        location: e.session.location, tracks: e.session.tracks,
        picked: col.isMe, conflict: col.isMe && conflicts.has(e.session.id),
        onOpen: () => onOpen?.(e.session),
      }))
      const colGhosts = dayEntries.filter((e) => !e.session)
      for (const g of colGhosts) gh.push({ column: col.label, id: g.id })
      if (col.envelope === 'stale') stale.push(col.label)
      if (items.length || colGhosts.length) {
        tl.push({
          key: col.id, label: col.label, color: swatch, tint, sticky: col.isMe, items,
          headExtra: !col.isMe && (
            <>
              <button className="icon-btn" style={{ width: 26, height: 26, boxShadow: 'none' }}
                aria-label="Move left" disabled={index <= 1} onClick={() => move(col.id, -1)}>‹</button>
              <button className="icon-btn" style={{ width: 26, height: 26, boxShadow: 'none' }}
                aria-label="Move right" disabled={index >= ordered.length - 1} onClick={() => move(col.id, 1)}>›</button>
              <button className="icon-btn" style={{ width: 26, height: 26, boxShadow: 'none' }}
                aria-label="Edit column" onClick={() => setEditing(col.id)}>⋯</button>
            </>
          ),
        })
      }
    })
    return { tlColumns: tl, ghosts: gh, staleColumns: stale }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, activeDay, conflicts, onOpen])

  const hasContent = tlColumns.some((c) => c.items.length) || ghosts.length > 0

  function move(columnId, delta) {
    const others = [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const index = others.findIndex((c) => c.id === columnId)
    const target = index + delta
    if (index < 0 || target < 0 || target >= others.length) return
    const [item] = others.splice(index, 1)
    others.splice(target, 0, item)
    onColumnsChange(others.map((c, i) => ({ ...c, order: i })))
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

      <div className="columns-toolbar">
        <button onClick={() => fileInput.current?.click()}>Load a schedule…</button>
        <button onClick={() => onExportShare(false)}>Share mine</button>
        <button onClick={() => onExportShare(true)} title="Includes your notes and ratings">Share + notes</button>
        <button className="pill-toggle" aria-pressed={compact} onClick={() => setCompact((v) => !v)}>Compact</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = '' }} />
      </div>

      {staleColumns.map((label) => (
        <div key={label} className="stale-banner">
          ⚠ {label}’s schedule was shared against older conference data — May be out of date.
        </div>
      ))}

      {!hasContent ? (
        <div className="empty-state">
          Nothing picked for this day yet.
          <span className="muted">
            {dayCounts.size > 0 ? 'Picks on other days — check the tabs above.' : 'Pick sessions in Browse and they land here.'}
          </span>
        </div>
      ) : (
        <ColumnTimeline columns={tlColumns} config={config} compact={compact} />
      )}

      {ghosts.length > 0 && (
        <div style={{ padding: '4px 18px 16px' }}>
          <p className="detail-caption" style={{ color: 'var(--warn)' }}>No longer in the schedule</p>
          {ghosts.map((g) => (
            <p key={`${g.column}-${g.id}`} className="block-ghost-note" style={{ wordBreak: 'break-all' }}>
              {g.column}: {g.id}
            </p>
          ))}
        </div>
      )}

      {editing && (
        <ColumnEditor
          column={columns.find((c) => c.id === editing)}
          onClose={() => setEditing(null)}
          onChange={(patch) => onColumnsChange(columns.map((c) => (c.id === editing ? { ...c, ...patch } : c)))}
          onRemove={() => { onColumnsChange(columns.filter((c) => c.id !== editing)); setEditing(null) }}
        />
      )}
    </>
  )
}

function ColumnEditor({ column, onClose, onChange, onRemove }) {
  if (!column) return null
  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Edit column</h2>
        <label style={{ display: 'block', marginTop: 12 }}>
          <span className="detail-caption" style={{ margin: 0 }}>Name</span>
          <input className="session-note" style={{ width: '100%', marginTop: 4 }}
            value={column.label} onChange={(e) => onChange({ label: e.target.value })} />
        </label>
        <fieldset className="color-picker">
          <legend>Colour</legend>
          {PERSON_COLORS.map((c) => (
            <button key={c.id} className={column.color === c.id ? 'is-selected' : ''}
              style={{ background: `hsl(${c.hue} 55% 50%)` }}
              onClick={() => onChange({ color: c.id })} aria-label={c.label} />
          ))}
        </fieldset>
        <p className="dialog-note">The name and colour are yours — they stay put if this person sends an update.</p>
        <div className="dialog-actions">
          <button className="btn-outline btn-quiet-danger" onClick={onRemove}>Remove</button>
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
