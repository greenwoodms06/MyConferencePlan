import { formatRange } from '../lib/time.js'
import { trackColor } from '../lib/palette.js'
import { canAttend } from '../lib/journal.js'

/** Stop a link click from also toggling selection on the card. */
const stop = (e) => e.stopPropagation()

export default function SessionCard({
  session, config, picked, conflicted, tier, onToggle, note, onNote,
}) {
  const attendable = canAttend(session, tier, config.accessLevels)
  const accent = trackColor(session.tracks[0], config)

  const handleToggle = () => {
    // Warn, don't block: badges get upgraded and sessions get opened up
    // (SPEC sect. 9.1).
    if (!picked && !attendable) {
      const tierLabel = config.accessLevels.find((l) => l.id === tier)?.label ?? tier
      const allowed = session.access.map(
        (a) => config.accessLevels.find((l) => l.id === a)?.label ?? a,
      ).join(', ')
      const ok = window.confirm(
        `“${session.title}” is listed for ${allowed}.\n` +
        `Your badge is ${tierLabel}.\n\nAdd it anyway?`,
      )
      if (!ok) return
    }
    onToggle(session)
  }

  return (
    <article
      className={[
        'session',
        picked && 'is-picked',
        conflicted && 'is-conflicted',
        !attendable && 'is-restricted',
      ].filter(Boolean).join(' ')}
      style={{ '--accent': accent }}
    >
      <button
        className="session-toggle"
        onClick={handleToggle}
        aria-pressed={picked}
        aria-label={picked ? `Remove ${session.title}` : `Add ${session.title}`}
      >
        <span className="session-check" aria-hidden="true">{picked ? '✓' : ''}</span>
      </button>

      <div className="session-body">
        <div className="session-meta">
          <time>{formatRange(session)}</time>
          {session.location && <span className="session-room">{session.location}</span>}
        </div>

        <h3 className="session-title">
          {session.url ? (
            <a href={session.url} target="_blank" rel="noreferrer noopener" onClick={stop}>
              {session.title}
            </a>
          ) : session.title}
        </h3>

        <div className="session-tracks">
          {session.tracks.map((track) => (
            <span
              key={track}
              className="chip"
              style={{ '--chip': trackColor(track, config) }}
            >
              {track}
            </span>
          ))}
        </div>

        {session.contributors?.length > 0 && (
          <p className="session-people">
            {session.contributors.map((c, i) => (
              <span key={`${c.name}-${i}`}>
                {i > 0 && ', '}
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer noopener" onClick={stop}>
                    {c.name}
                  </a>
                ) : c.name}
              </span>
            ))}
          </p>
        )}

        <div className="session-flags">
          {session.access?.length > 0 && (
            <span className={`access ${attendable ? '' : 'access-blocked'}`}>
              {session.access.join(' · ')}
              {!attendable && ' — not on your badge'}
            </span>
          )}
          {conflicted && <span className="conflict-flag">Overlaps another pick</span>}
        </div>

        {picked && (
          <textarea
            className="session-note"
            placeholder="Notes for yourself…"
            value={note ?? ''}
            onChange={(e) => onNote(session.id, e.target.value)}
            onClick={stop}
            rows={note ? 3 : 1}
          />
        )}
      </div>
    </article>
  )
}
