import { useState } from 'react'
import { applyOverwrite, matchExistingColumn } from '../lib/share.js'
import { nextPersonColor } from '../lib/palette.js'

/**
 * Import confirmation (SPEC sect. 6.4).
 *
 * `sender.id` is minted once and persisted, so a re-export auto-matches the
 * existing column — this is a CONFIRMATION with an escape hatch, not a quiz.
 * The dropdown still exists because no automatic scheme handles both
 * "two different people named Alex" and "one Alex, two devices".
 */
export default function ImportDialog({ pending, columns, onCancel, onConfirm }) {
  const { share, resolved } = pending
  const match = matchExistingColumn(share, columns)
  const [target, setTarget] = useState(match.column?.id ?? '__new__')
  const [label, setLabel] = useState(share.sender?.name ?? 'Colleague')

  if (!resolved.ok) {
    return (
      <Shell onCancel={onCancel} title="Can’t load this file">
        {resolved.problems.map((p) => <p key={p.kind}>{p.message}</p>)}
        <div className="dialog-actions"><button onClick={onCancel}>Close</button></div>
      </Shell>
    )
  }

  const confirm = () => {
    if (target === '__new__') {
      onConfirm([
        ...columns,
        {
          id: `col-${share.sender?.id ?? Math.random().toString(36).slice(2)}`,
          label,
          color: nextPersonColor(columns.map((c) => c.color)),
          order: columns.length,
          sender: resolved.sender,
          dataVersion: resolved.dataVersion,
          envelope: resolved.envelope,
          entries: resolved.entries,
        },
      ])
    } else {
      onConfirm(columns.map((c) => (c.id === target ? applyOverwrite(c, resolved) : c)))
    }
  }

  const existing = columns.find((c) => c.id === target)

  return (
    <Shell onCancel={onCancel} title={`${share.sender?.name ?? 'Someone'}’s schedule`}>
      <p>
        {resolved.entries.length} sessions
        {resolved.unresolvedCount > 0 && (
          <> · <span className="warn">{resolved.unresolvedCount} no longer in the schedule</span></>
        )}
      </p>

      {resolved.problems.map((p) => (
        <p key={p.kind} className="dialog-warning">{p.message}</p>
      ))}

      <label>
        Add as
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="__new__">A new column</option>
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              Replace “{c.label}”{c.sender?.id === share.sender?.id ? ' (same person)' : ''}
            </option>
          ))}
        </select>
      </label>

      {target === '__new__' ? (
        <label>
          Name this column
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
      ) : (
        <p className="dialog-warning">
          This replaces {existing?.label}’s picks{share.annotations ? ' and notes' : ''}.
          Your name, colour and column position stay as they are.
        </p>
      )}

      {match.confidence === 'name' && target !== '__new__' && (
        <p className="muted">
          Matched by name only — if this is a different person with the same name,
          choose “A new column” instead.
        </p>
      )}

      <div className="dialog-actions">
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={confirm}>
          {target === '__new__' ? 'Add column' : 'Replace'}
        </button>
      </div>
    </Shell>
  )
}

function Shell({ title, children, onCancel }) {
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
