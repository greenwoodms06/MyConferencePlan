import { describe, test, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'

import PickerView from '../src/components/PickerView.jsx'
import ColumnsView from '../src/components/ColumnsView.jsx'
import SessionCard from '../src/components/SessionCard.jsx'
import ChangeBanner from '../src/components/ChangeBanner.jsx'
import ChangeReviewSheet from '../src/components/ChangeReviewSheet.jsx'
import ImportDialog from '../src/components/ImportDialog.jsx'
import SettingsPanel from '../src/components/SettingsPanel.jsx'

import { newJournal, addPick } from '../src/lib/journal.js'
import { buildShareFile, resolveShareFile, buildResolver } from '../src/lib/share.js'
import { findConflicts } from '../src/lib/overlap.js'

const sessions = JSON.parse(readFileSync(new URL('../public/data/siggraph-2026/sessions.json', import.meta.url)))
const config = JSON.parse(readFileSync(new URL('../public/data/siggraph-2026/config.json', import.meta.url)))
const sessionsById = buildResolver(sessions)
const TUESDAY = '2026-07-21'

const noop = () => {}

function journalWith(ids, extra = {}) {
  let j = { ...newJournal(config.conferenceId, 'Me'), ...extra }
  for (const id of ids) j = addPick(j, sessionsById.get(id), config.dataVersion)
  return j
}

/** Two sessions that genuinely overlap, for conflict rendering. */
function overlappingPair() {
  const day = sessions.filter((s) => s.day === TUESDAY)
  for (const a of day) {
    const b = day.find(
      (x) => x.id !== a.id && x.start < a.end && a.start < x.end && x.start >= a.start,
    )
    if (b) return [a, b]
  }
  throw new Error('expected overlapping sessions in the real data')
}

describe('PickerView', () => {
  const base = {
    config, sessions, activeDay: TUESDAY, setActiveDay: noop,
    conflicts: new Map(), onTogglePick: noop, onUpdatePick: noop,
  }

  test('renders a full 123-session day without crashing', () => {
    const html = renderToStaticMarkup(
      <PickerView {...base} pickedIds={new Set()} journal={journalWith([])} />,
    )
    expect(html).toContain('123 of 123 sessions')
    for (const day of config.days) expect(html).toContain(day.label)
  })

  test('session and contributor links are real, separate, and open safely', () => {
    const html = renderToStaticMarkup(
      <PickerView {...base} pickedIds={new Set()} journal={journalWith([])} />,
    )
    expect(html).toContain('rel="noreferrer noopener"')
    expect(html).toContain('sess=')   // session links
    expect(html).toContain('uid=')    // contributor links — a different kind
    // Every anchor that opens a new tab must carry noopener.
    const targets = html.match(/<a [^>]*target="_blank"[^>]*>/g) ?? []
    expect(targets.length).toBeGreaterThan(50)
    for (const a of targets) expect(a).toContain('noopener')
  })

  test('picked sessions show as selected and expose a note field', () => {
    const picked = sessions.find((s) => s.day === TUESDAY)
    const html = renderToStaticMarkup(
      <PickerView {...base}
        pickedIds={new Set([picked.id])}
        journal={journalWith([picked.id])} />,
    )
    expect(html).toContain('is-picked')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Notes for yourself')
  })

  test('day tab shows a count badge for that day only', () => {
    const picks = sessions.filter((s) => s.day === TUESDAY).slice(0, 3).map((s) => s.id)
    const html = renderToStaticMarkup(
      <PickerView {...base} pickedIds={new Set(picks)} journal={journalWith(picks)} />,
    )
    expect(html).toContain('day-count')
    expect(html).toContain('>3<')
  })

  test('cross-listed sessions render every track chip', () => {
    const multi = sessions.find((s) => s.tracks.length > 1 && s.day === TUESDAY)
    const html = renderToStaticMarkup(
      <SessionCard session={multi} config={config} picked={false}
        conflicted={false} tier={null} onToggle={noop} onNote={noop} />,
    )
    for (const track of multi.tracks) expect(html).toContain(track)
  })

  test('access tiers are shown on the card, never hidden (warn, not block)', () => {
    const restricted = sessions.find((s) => s.access?.length && !s.access.includes('D'))
    const html = renderToStaticMarkup(
      <SessionCard session={restricted} config={config} picked={false}
        overlapWith={null} onToggle={noop} onNote={noop} onRate={noop} />,
    )
    expect(html).toContain(restricted.title)                 // never hidden
    expect(html).toContain(restricted.access.join(' · '))    // tier list shown
  })

  test('conflicting picks are flagged', () => {
    const [a, b] = overlappingPair()
    const conflicts = findConflicts([a, b])
    const html = renderToStaticMarkup(
      <PickerView {...base}
        conflicts={conflicts}
        pickedIds={new Set([a.id, b.id])}
        journal={journalWith([a.id, b.id])} />,
    )
    expect(html).toContain('is-conflicted')
    expect(html).toContain('Overlaps')     // amber overlap chip
  })
})

describe('ColumnsView', () => {
  const base = {
    config, sessionsById, columns: [], activeDay: TUESDAY, setActiveDay: noop,
    conflicts: new Map(), onColumnsChange: noop, onImportFile: noop, onExportShare: noop,
  }

  test('empty state when nothing is picked for the day', () => {
    const html = renderToStaticMarkup(<ColumnsView {...base} journal={journalWith([])} />)
    expect(html).toContain('Nothing picked for this day yet')
  })

  test('proportional axis: block offset and height track real times', () => {
    const picks = sessions.filter((s) => s.day === TUESDAY).slice(0, 4)
    const html = renderToStaticMarkup(
      <ColumnsView {...base} journal={journalWith(picks.map((s) => s.id))} />,
    )
    expect(html).toContain('timeline')
    expect(html).toContain('hour-mark')
    // Absolute positioning is what makes gaps legible; without it the view
    // cannot answer "when is everyone free".
    expect(html).toMatch(/class="block[^"]*"[^>]*style="[^"]*top:/)
    for (const s of picks) expect(html).toContain(s.title)
  })

  test('my column is present and marked as the anchor', () => {
    const pick = sessions.find((s) => s.day === TUESDAY)
    const html = renderToStaticMarkup(
      <ColumnsView {...base} journal={journalWith([pick.id], { sender: { id: 'me', name: 'Sam' } })} />,
    )
    expect(html).toContain('sticky')   // Me head pinned as the anchor
    expect(html).toContain('Sam')
  })

  test('an imported colleague renders as its own column', () => {
    const mine = sessions.filter((s) => s.day === TUESDAY)[0]
    const theirs = sessions.filter((s) => s.day === TUESDAY).slice(3, 6)
    const columns = [{
      id: 'col1', label: 'Alex', color: 'violet', order: 0,
      sender: { id: 'u1', name: 'Alex' }, envelope: 'current',
      entries: theirs.map((s) => ({ id: s.id, session: s, state: 'resolved' })),
    }]
    const html = renderToStaticMarkup(
      <ColumnsView {...base} columns={columns} journal={journalWith([mine.id])} />,
    )
    expect(html).toContain('Alex')
    for (const s of theirs) expect(html).toContain(s.title)
  })

  test('THREE render states: resolved, ghost, stale envelope', () => {
    const real = sessions.filter((s) => s.day === TUESDAY)[0]
    const columns = [{
      id: 'col1', label: 'Alex', color: 'violet', order: 0,
      sender: { id: 'u1', name: 'Alex' },
      envelope: 'stale', dataVersion: '2026-06-01',
      entries: [
        { id: real.id, session: real, state: 'resolved' },
        { id: 'cancelled-session-id', session: null, state: 'unresolvable' },
      ],
    }]
    const html = renderToStaticMarkup(
      <ColumnsView {...base} columns={columns} journal={journalWith([])} />,
    )
    expect(html).toContain(real.title)                       // resolved
    expect(html).toContain('No longer in the schedule')      // ghost — never dropped
    expect(html).toContain('cancelled-session-id')
    expect(html).toContain('May be out of date')             // stale envelope
  })

  test('compact mode is available but is not the default', () => {
    const picks = sessions.filter((s) => s.day === TUESDAY).slice(0, 3).map((s) => s.id)
    const html = renderToStaticMarkup(
      <ColumnsView {...base} journal={journalWith(picks)} />,
    )
    expect(html).toContain('Compact')
    expect(html).not.toContain('compact-columns')  // proportional is the default
    expect(html).toContain('timeline-inner')
  })
})

describe('dialogs and banners', () => {
  const changeFixture = () => {
    const session = sessions[0]
    return [
      { id: session.id, session, kind: 'changed', changes: [{ field: 'start', from: '09:00', to: '11:30' }, { field: 'location', from: 'Room A', to: 'Room B' }] },
      { id: 'gone-id', session: null, kind: 'gone', pick: { snapshot: { title: 'A Cancelled Session' } }, changes: [] },
    ]
  }

  test('ChangeBanner is a slim impact summary that opens the review sheet', () => {
    const html = renderToStaticMarkup(<ChangeBanner count={2} onReview={noop} />)
    expect(html).toContain('Schedule updated — 2 of your picks changed')
    expect(html).toContain('Review')
  })

  test('ChangeReviewSheet shows per-pick diffs, per-item + ack-all, and cancelled picks', () => {
    const html = renderToStaticMarkup(
      <ChangeReviewSheet changes={changeFixture()} onAckOne={noop} onAckAll={noop} onRemoveGone={noop} onClose={noop} />,
    )
    expect(html).toContain('Your picks changed')
    expect(html).toContain(sessions[0].title)          // the moved pick
    expect(html).toContain('Starts')                    // field-level diff label
    expect(html).toContain('11:30')                     // new value
    expect(html).toContain('Got it')                    // per-item acknowledge
    expect(html).toContain('Acknowledge all')
    expect(html).toContain('A Cancelled Session')       // gone pick, never dropped
    expect(html).toContain('Remove from my picks')
  })

  test('ImportDialog offers new-column vs replace, and warns on overwrite', () => {
    const share = buildShareFile(journalWith([sessions[0].id]), config)
    const resolved = resolveShareFile(share, { sessions, config })
    const columns = [{
      id: 'col1', label: 'Alex', color: 'violet', order: 0,
      sender: share.sender, entries: [],
    }]
    const html = renderToStaticMarkup(
      <ImportDialog pending={{ share, resolved }} columns={columns}
        onCancel={noop} onConfirm={noop} />,
    )
    expect(html).toContain('A new column')
    expect(html).toContain('Replace')
    // Auto-matched by stable sender id -> confirmation, not a quiz.
    expect(html).toContain('Matched an existing column by sender ID')
    expect(html).toContain('colour and column position stay as they are')
  })

  test('ImportDialog refuses a file from a different conference', () => {
    const share = buildShareFile(journalWith([sessions[0].id]), config)
    const foreign = { ...share, conferenceId: 'siggraph-2025' }
    const resolved = resolveShareFile(foreign, { sessions, config })
    const html = renderToStaticMarkup(
      <ImportDialog pending={{ share: foreign, resolved }} columns={[]}
        onCancel={noop} onConfirm={noop} />,
    )
    expect(html).toContain('Can’t load this file')
    expect(html).toContain('siggraph-2025')
  })

  test('SettingsPanel warns when storage is not persisted', () => {
    const html = renderToStaticMarkup(
      <SettingsPanel config={config} journal={journalWith([])}
        storage={{ supported: true, persisted: false, usage: 51200, quota: 1e9 }}
        onClose={noop} onSetTier={noop} onSetName={noop} onBackup={noop} onRestore={noop} />,
    )
    expect(html).toContain('not granted')
    expect(html).toContain('Back up now')
    // A backup you cannot restore is not a durability story (SPEC §5.3).
    expect(html).toContain('Restore a backup')
    for (const level of config.accessLevels) expect(html).toContain(level.label)
    // About/info block: name + version + repo + the AI conversion helper.
    expect(html).toContain('Copy AI conversion prompt')
    expect(html).toContain('github.com/greenwoodms06/SessionSamba')
    expect(html).toMatch(/SessionSamba v\d+\.\d+\.\d+/)
  })
})

describe('App shell', () => {
  test('mounts and shows a loading state before data arrives', async () => {
    const { default: App } = await import('../src/App.jsx')
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('Loading schedule')
  })

  test('every module imports cleanly', async () => {
    // Cheap guard against a bad import path or typo'd export surviving because
    // no test happened to render that branch.
    const modules = [
      '../src/App.jsx', '../src/components/PickerView.jsx',
      '../src/components/ColumnsView.jsx', '../src/components/SessionCard.jsx',
      '../src/components/ChangeBanner.jsx', '../src/components/ImportDialog.jsx',
      '../src/components/SettingsPanel.jsx', '../src/lib/palette.js',
      '../src/lib/storage.js', '../src/lib/journal.js', '../src/lib/share.js',
      '../src/lib/ics.js', '../src/lib/overlap.js', '../src/lib/time.js',
    ]
    for (const path of modules) {
      expect(await import(path)).toBeTruthy()
    }
  })
})

import { validateBundle } from '../src/lib/registry.js'
import ConferenceSwitcher from '../src/components/ConferenceSwitcher.jsx'

describe('conference registry + switcher', () => {
  test('validateBundle accepts a good bundle, rejects malformed ones', () => {
    assert_ok(validateBundle({ config, sessions }).ok === true)
    assert_ok(validateBundle({}).ok === false)
    assert_ok(validateBundle({ config: { name: 'X' }, sessions: [] }).ok === false)
    assert_ok(validateBundle({ config: { conferenceId: 'x', name: 'X', days: [] }, sessions: [] }).ok === false)
    assert_ok(validateBundle({ config: { conferenceId: 'x', name: 'X', days: [{ key: 'd' }] }, sessions: [{ id: 'a' }] }).ok === false)
  })

  test('manifest lists siggraph-2026 with a per-conference path + switcher metadata', () => {
    const manifest = JSON.parse(readFileSync(new URL('../public/data/index.json', import.meta.url)))
    const entry = manifest.conferences.find((c) => c.id === 'siggraph-2026')
    expect(entry).toBeTruthy()
    expect(entry.path).toBe('siggraph-2026')
    expect(entry.accent).toBeTruthy()
    expect(entry.dateRange).toBeTruthy()
  })

  test('switcher renders each conference with the active one marked, plus the add affordance', () => {
    const confs = [
      { id: 'siggraph-2026', name: 'SIGGRAPH 2026', accent: '#3d5af1', dateRange: 'Jul 19–23', location: 'Los Angeles', dataVersion: '2026-07-20', source: 'bundled' },
      { id: 'gdc-2026', name: 'GDC 2026', accent: '#0d9488', dateRange: 'Mar 16–20', location: 'San Francisco', dataVersion: '2026-03-01', source: 'bundled' },
    ]
    const html = renderToStaticMarkup(
      <ConferenceSwitcher conferences={confs} activeId="siggraph-2026" activeConfig={config}
        onSwitch={noop} onAdded={noop} onClose={noop} onToast={noop} />,
    )
    expect(html).toContain('Your conferences')
    expect(html).toContain('SIGGRAPH 2026')
    expect(html).toContain('GDC 2026')
    // The active conference's own links (config.url + config.links) render as
    // chips; absent config would render none (SPEC §1.3).
    expect(html).toContain('Website')
    for (const link of config.links) expect(html).toContain(link.label)
    expect(html).toContain('Los Angeles')
    expect(html).toContain('is-active')              // active row highlighted
    expect(html).toContain('Add a conference')       // add affordance present
  })
})

function assert_ok(cond) { expect(cond).toBe(true) }
