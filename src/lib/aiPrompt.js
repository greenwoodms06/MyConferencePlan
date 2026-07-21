/** The "Copy AI prompt" text in Settings — no AI integration, just a prompt
 *  the user pastes into any chat together with an event's published schedule.
 *  Built from validate.js's field list so prompt and validator can't drift
 *  (lib.test.js pins the coupling, same pattern as PageToPlate's aiPrompt).
 */

import { REQUIRED_SESSION_FIELDS } from './validate.js'

export const AI_CONVERT_PROMPT = `Convert the attached event schedule (page text, PDF, spreadsheet, or photos) into a SessionSamba bundle: ONE JSON object with "config" and "sessions".

Rules:
1. Output JSON only — no commentary, no markdown code fences.
2. Shape:
{
  "config": {
    "schemaVersion": 1,
    "conferenceId": "<short-kebab-case id, e.g. gdc-2027>",
    "dataVersion": "<today, YYYY-MM-DD>",
    "name": "<event name>",
    "timezone": "<IANA zone of the venue, e.g. America/Los_Angeles>",
    "days": [{ "key": "YYYY-MM-DD", "label": "Monday", "date": "16 Mar" }]
  },
  "sessions": [{
    "id": "<conferenceId>-<slug-of-track-and-title>",
    "day": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM",
    "title": "…", "tracks": ["<the event's own category name>"], "tags": [],
    "location": "…", "url": "…",
    "contributors": [{ "name": "…", "url": "…" }], "access": ["<tier id>"]
  }]
}
3. Every session needs ${REQUIRED_SESSION_FIELDS.join(', ')}. The id must be a stable slug built from track + title — NEVER from time or room (those change before the event and would orphan saved picks). If the same title recurs on several days, append the day key to the id.
4. Times are 24h HH:MM wall-clock in the event's timezone; "day" must exactly match a config.days key.
5. "tracks" is an array — keep every category a cross-listed session belongs to.
6. location, url, contributors, access, description are optional: omit what the source doesn't state rather than inventing it.
7. If the event has badge/ticket tiers, declare them in config.accessLevels as [{ "id", "label" }] ordered most-privileged first, and give each restricted session an explicit "access" array of tier ids.
8. Transcribe only what you can actually read in the source — never invent, merge, or reword sessions.`
