import { useEffect, useRef, useState } from 'react'

/**
 * Session note editor. Reads as a single quiet line, and grows into a proper
 * multi-line editing space while focused (auto-sized to content). Notes are
 * plain text throughout — newlines already survive share annotations and are
 * escaped into .ics DESCRIPTION.
 */
export default function NoteField({ value, onChange, placeholder = 'Notes for yourself…' }) {
  const ref = useRef(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, editing])

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`session-note${editing ? ' is-editing' : ''}`}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={() => setEditing(false)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}
