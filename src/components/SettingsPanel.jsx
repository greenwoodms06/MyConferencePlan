/** Settings: badge tier, display name, and an honest storage report.
 *
 *  The storage section exists because the journal holds hand-authored notes
 *  that cannot be regenerated, and browsers evict script-writable storage.
 *  Telling the user they're unprotected beats letting them find out by data
 *  loss (SPEC sect. 5.3).
 */
export default function SettingsPanel({
  config, journal, storage, onClose, onSetTier, onSetName, onBackup,
}) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <label>
          Your name (shown when you share)
          <input
            value={journal.sender.name}
            onChange={(e) => onSetName(e.target.value)}
            placeholder="Me"
          />
        </label>

        {config.accessLevels?.length > 0 && (
          <label>
            Your badge
            <select
              value={journal.profile.accessTier ?? ''}
              onChange={(e) => onSetTier(e.target.value || null)}
            >
              <option value="">Not set — show everything</option>
              {config.accessLevels.map((level) => (
                <option key={level.id} value={level.id}>{level.label}</option>
              ))}
            </select>
          </label>
        )}
        <p className="muted">
          Your badge only adds a warning — it never stops you adding a session.
          Badges get upgraded and sessions get opened up.
        </p>

        <section className="settings-storage">
          <h3>Your data</h3>
          {storage?.persisted ? (
            <p className="ok">Your notes are marked as persistent on this device.</p>
          ) : (
            <p className="warn">
              This browser may clear your picks and notes if you don’t open the app
              for a while. Keep a backup.
            </p>
          )}
          {storage?.usage != null && (
            <p className="muted">
              Using {(storage.usage / 1024).toFixed(0)} KB
              {storage.quota ? ` of ~${(storage.quota / 1024 / 1024).toFixed(0)} MB available` : ''}.
            </p>
          )}
          <button onClick={onBackup}>Download a backup now</button>
          <p className="muted">
            The backup includes every conference, your notes and ratings. It lands in
            your Downloads folder, which the browser never clears.
          </p>
        </section>

        <div className="dialog-actions">
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
