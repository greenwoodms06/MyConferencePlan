/** Settings — bottom sheet (Companion design). Badge tier, display name, and an
 *  honest storage report (the journal holds hand-authored notes browsers can
 *  evict; telling the user beats silent data loss — SPEC §5.3). */
export default function SettingsPanel({
  config, journal, storage, onClose, onSetTier, onSetName, onBackup, onIcs,
}) {
  const tier = journal.profile.accessTier
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Settings">
        <div className="sheet-grip" />
        <h2>Settings</h2>

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
          {onIcs && <button className="btn-outline" onClick={onIcs}>Export .ics</button>}
        </div>
      </div>
    </>
  )
}
