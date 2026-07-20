/** Time helpers. All schedule times are 24h "HH:MM" wall-clock in the
 *  conference's timezone (SPEC sect. 4). */

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

export function fromMinutes(total) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function durationMinutes(session) {
  return toMinutes(session.end) - toMinutes(session.start)
}

/** "14:00" -> "2:00 PM" */
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h < 12 ? 'AM' : 'PM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatRange(session) {
  return `${formatTime(session.start)} – ${formatTime(session.end)}`
}

/**
 * The UTC offset (ms) that `timeZone` was at a given UTC instant.
 * Uses Intl rather than a bundled tz database.
 */
function offsetAt(utcMs, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = {}
  for (const { type, value } of dtf.formatToParts(new Date(utcMs))) parts[type] = value
  // `hour` can come back as "24" at midnight in some engines.
  const hour = Number(parts.hour) % 24
  const asIfUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second),
  )
  return asIfUtc - utcMs
}

/**
 * Wall-clock time in a named zone -> the UTC instant (ms).
 *
 * We emit `.ics` in UTC rather than TZID + VTIMEZONE: it is unambiguous and
 * universally supported, and it avoids shipping a timezone database.
 */
export function zonedToUtcMs(dayKey, hhmm, timeZone) {
  const [y, mo, d] = dayKey.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const naive = Date.UTC(y, mo - 1, d, h, mi)
  // One correction pass, then a second to settle DST boundaries.
  let utc = naive - offsetAt(naive, timeZone)
  utc = naive - offsetAt(utc, timeZone)
  return utc
}

/** UTC ms -> "20260721T210000Z" */
export function toIcsUtc(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
