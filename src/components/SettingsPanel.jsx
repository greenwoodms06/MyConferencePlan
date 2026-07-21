import { useRef, useState } from 'react'
import { AI_CONVERT_PROMPT } from '../lib/aiPrompt.js'
import { version } from '../../package.json'

const REPO_URL = 'https://github.com/greenwoodms06/SessionSamba'

/** Settings bottom sheet. Badge tier, display name, an honest storage report
 *  (the journal holds hand-authored notes browsers can evict; telling the user
 *  beats silent data loss — SPEC §5.3), and the about/add-a-conference info. */
export default function SettingsPanel({
  config, journal, storage, theme, onSetTheme, onClose, onSetTier, onSetName,
  onBackup, onRestore, onIcs,
}) {
  const tier = journal.profile.accessTier
  const restoreInput = useRef(null)
  const [copied, setCopied] = useState(false)

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_CONVERT_PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard blocked; the SPEC link still documents the format */ }
  }
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Settings">
        <div className="sheet-grip" />
        <h2>Settings</h2>

        <p className="filter-hint" style={{ marginTop: 14 }}>Appearance</p>
        <div className="segmented" style={{ width: 'fit-content' }}>
          {['system', 'light', 'dark'].map((t) => (
            <button key={t} aria-selected={theme === t}
              onClick={() => onSetTheme(t)} style={{ textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        <label style={{ display: 'block', marginTop: 14 }}>
          <span className="detail-caption" style={{ margin: 0 }}>Your name (shown when you share)</span>
          <input className="session-note" style={{ width: '100%', marginTop: 4 }}
            value={journal.sender.name} placeholder="Me"
            onChange={(e) => onSetName(e.target.value)} />
        </label>

        {config.accessLevels?.length > 0 && (
          <>
            <p className="filter-hint">My badge tier — sessions outside it warn, never block</p>
            <div className="tier-row">
              <button className="tier-btn" aria-pressed={!tier} onClick={() => onSetTier(null)}>Any</button>
              {config.accessLevels.map((level) => (
                <button key={level.id} className="tier-btn" aria-pressed={tier === level.id}
                  onClick={() => onSetTier(level.id)} title={level.label}>{level.id}</button>
              ))}
            </div>
          </>
        )}

        <div className="storage-well">
          {storage?.persisted
            ? <>Persistent storage: <span className="ok">granted</span></>
            : <>Persistent storage: <span className="warn">not granted — keep a backup</span></>}
          {storage?.usage != null && ` · ${(storage.usage / 1024 / 1024).toFixed(1)} MB used`}
          <br /><span className="muted">Auto-backup runs at the end of each conference day, into your Downloads folder.</span>
        </div>

        <div className="sheet-actions">
          <button className="btn-primary" onClick={onBackup}>Back up now</button>
          {onRestore && (
            <button className="btn-outline" onClick={() => restoreInput.current?.click()}>
              Restore a backup…
            </button>
          )}
          {onIcs && <button className="btn-outline" onClick={onIcs}>Export .ics</button>}
        </div>
        {onRestore && (
          <input ref={restoreInput} type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onRestore(f); e.target.value = '' }} />
        )}

        <p className="filter-hint">Add a conference</p>
        <p className="settings-about-text">
          Any event can run here — it just needs a bundle file (<code>config</code> +{' '}
          <code>sessions</code>). Copy this prompt, paste it into any AI chat together
          with the event&rsquo;s published schedule (page text, PDF, or photos), then load
          the JSON it returns via the ▾ switcher in the header.
        </p>
        <button className="btn-outline settings-copy-prompt" onClick={copyPrompt}>
          {copied ? '✓ Copied' : 'Copy AI conversion prompt'}
        </button>

        <p className="settings-version">
          SessionSamba v{version} ·{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer noopener">source on GitHub</a>
        </p>
      </div>
    </>
  )
}
