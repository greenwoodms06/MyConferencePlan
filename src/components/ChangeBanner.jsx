import { useState } from 'react'
import { formatTime } from '../lib/time.js'

const FIELD_LABEL = { title: 'Renamed', start: 'Start time', end: 'End time', location: 'Room' }

/**
 * Notify by IMPACT, not by event (SPEC sect. 8.1). Not "the schedule changed" —
 * which nobody reads — but "these sessions YOU picked have moved".
 *
 * Nothing is auto-removed. A cancelled pick stays visible until the user
 * decides, because a silent drop reads as "you're free then" (SPEC sect. 1.5).
 */
export default function ChangeBanner({ changes, onAcknowledge, onRemoveGone }) {
  const [open, setOpen] = useState(false)
  const moved = changes.filter((c) => c.kind === 'changed')
  const gone = changes.filter((c) => c.kind === 'gone')

  return (
    <div className="change-banner">
      <div className="change-summary">
        <strong>
          {moved.length > 0 && `${moved.length} of your sessions changed`}
          {moved.length > 0 && gone.length > 0 && ' · '}
          {gone.length > 0 && `${gone.length} no longer in the schedule`}
        </strong>
        <button className="link-button" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Review'}
        </button>
      </div>

      {open && (
        <div className="change-detail">
          {moved.map((change) => (
            <div key={change.id} className="change-row">
              <p className="change-title">{change.session.title}</p>
              <ul>
                {change.changes.map((c) => (
                  <li key={c.field}>
                    {FIELD_LABEL[c.field] ?? c.field}:{' '}
                    <s>{formatMaybeTime(c.field, c.from)}</s> → <b>{formatMaybeTime(c.field, c.to)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {gone.map((change) => (
            <div key={change.id} className="change-row is-gone">
              <p className="change-title">
                {change.pick.snapshot?.title ?? change.id}
              </p>
              <p className="muted">
                This session is no longer in the schedule. It may have been cancelled,
                or renamed beyond recognition.
              </p>
              <button className="link-button" onClick={() => onRemoveGone(change.id)}>
                Remove from my picks
              </button>
            </div>
          ))}

          {moved.length > 0 && (
            <button onClick={onAcknowledge}>Got it — stop showing these</button>
          )}
        </div>
      )}
    </div>
  )
}

function formatMaybeTime(field, value) {
  if (value == null || value === '') return '—'
  return field === 'start' || field === 'end' ? formatTime(value) : value
}
