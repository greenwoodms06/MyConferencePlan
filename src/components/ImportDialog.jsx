import { useState } from 'react'
import { applyOverwrite, matchExistingColumn } from '../lib/share.js'
import { nextPersonColor } from '../lib/palette.js'

/**
 * Import confirmation (SPEC §6.4). `sender.id` is minted once and persisted, so
 * a re-export auto-matches the existing column — this is a CONFIRMATION with an
 * escape hatch (radio cards), not a quiz. The escape hatch stays because no
 * automatic scheme handles both "two people named Alex" and "one Alex, two devices".
 */
export default function ImportDialog({ pending, columns, onCancel, onConfirm }) {
  const { share, resolved } = pending
  const match = matchExistingColumn(share, columns)
  const [target, setTarget] = useState(match.column?.id ?? '__new__')
  const [label, setLabel] = useState(share.sender?.name ?? 'Colleague')

  if (!resolved.ok) {
    return (
      <div className="dialog-scrim" onClick={onCancel}>
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <h2>Can’t load this file</h2>
          {resolved.problems.map((p) => <p key={p.kind} className="dialog-meta">{p.message}</p>)}
          <div className="dialog-actions"><button className="btn-primary" onClick={onCancel}>Close</button></div>
        </div>
      </div>
    )
  }

  const confirm = () => {
    if (target === '__new__') {
      onConfirm([...columns, {
        id: `col-${share.sender?.id ?? Math.random().toString(36).slice(2)}`,
        label, color: nextPersonColor(columns.map((c) => c.color)), order: columns.length,
        sender: resolved.sender, dataVersion: resolved.dataVersion,
        envelope: resolved.envelope, entries: resolved.entries,
      }])
    } else {
      onConfirm(columns.map((c) => (c.id === target ? applyOverwrite(c, resolved) : c)))
    }
  }

  const meta = `From “${share.sender?.name ?? 'Someone'}” · ${resolved.entries.length} picks`
    + (share.dataVersion ? ` · made against ${share.dataVersion} data` : '')

  return (
    <div className="dialog-scrim" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Import a shared schedule</h2>
        <div className="dialog-meta">{meta}</div>

        {resolved.unresolvedCount > 0 && (
          <p className="dialog-warning" style={{ marginTop: 10 }}>
            {resolved.unresolvedCount} no longer in the schedule — shown struck through, never dropped.
          </p>
        )}

        {columns.map((c) => (
          <button key={c.id} className="radio-card" aria-pressed={target === c.id} onClick={() => setTarget(c.id)}>
            <span className="rc-head"><span className="rc-dot" /><span className="rc-label">Replace “{c.label}”</span></span>
            <div className="rc-sub">
              {c.sender?.id === share.sender?.id ? 'Matched an existing column by sender ID' : 'Overwrite this column’s picks'}
            </div>
          </button>
        ))}

        <button className="radio-card" aria-pressed={target === '__new__'} onClick={() => setTarget('__new__')}>
          <span className="rc-head"><span className="rc-dot" /><span className="rc-label">A new column</span></span>
          <div className="rc-sub">Add as a separate person</div>
        </button>

        {target === '__new__' && (
          <input className="session-note" style={{ width: '100%', marginTop: 10 }}
            value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name this column" />
        )}

        <p className="dialog-note">
          Replaces the pick set and shared notes only — your name, colour and column position stay as they are.
          Hotel/flight extras never travel in share files.
        </p>

        {match.confidence === 'name' && target !== '__new__' && (
          <p className="dialog-note">Matched by name only — if this is a different person, choose “A new column”.</p>
        )}

        <div className="dialog-actions">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={confirm}>Import</button>
        </div>
      </div>
    </div>
  )
}
