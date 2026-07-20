# Conference Schedule Planner PWA — Build Brief

## Goal
A shareable, installable **PWA** that lets attendees filter a conference schedule,
build a personal agenda, see time conflicts, get interest-based recommendations, and
export to calendar. First deployment: **SIGGRAPH 2026** (Los Angeles, 19–23 July),
scope **Sun 19 – Wed 22 July**. But build it **generic**: the app reads a standardized
schedule file, so any conference can reuse it by swapping one data file + one config.

## Hard requirements (decided)
- **Framework**: Vite + React.
- **Hosting**: GitHub Pages (static). Must build to a `dist/` deployable via GitHub
  Actions. Set Vite `base` to the repo name (e.g. `/conf-planner/`) so asset paths work
  on Pages. Include a `.github/workflows/deploy.yml` that builds and publishes on push
  to `main`.
- **PWA**: installable, offline-capable. Add a web manifest (name, icons, theme,
  `display: standalone`) and a service worker that precaches the app shell + schedule
  JSON so it works on the show floor with bad wifi. `vite-plugin-pwa` is fine.
- **Storage**: **localStorage only**, per-device. No backend, no accounts. A user's
  selected agenda persists locally. Key it per-conference (e.g. `agenda:{conferenceId}`)
  so multiple conferences don't collide.
- **Generic by design**: no SIGGRAPH specifics hard-coded in components. All
  conference-specific content lives in the data + config files below.

## Standardized schedule format (the reusable contract)
Two files under `src/data/` (or `public/data/` if you want them swappable without
rebuild). Define these as the public schema — document them in the README so others
can author their own conference.

### `config.json` — conference-level settings
```json
{
  "conferenceId": "siggraph-2026",
  "name": "SIGGRAPH 2026",
  "location": "Los Angeles Convention Center, 1201 S Figueroa St, LA 90015",
  "timezone": "America/Los_Angeles",
  "days": [
    { "key": "2026-07-19", "label": "Sunday", "date": "19 Jul" },
    { "key": "2026-07-20", "label": "Monday", "date": "20 Jul" },
    { "key": "2026-07-21", "label": "Tuesday", "date": "21 Jul" },
    { "key": "2026-07-22", "label": "Wednesday", "date": "22 Jul" }
  ],
  "tracks": [
    { "id": "research",   "label": "Research",          "color": "#2563eb" },
    { "id": "production", "label": "Production",         "color": "#7c3aed" },
    { "id": "games",      "label": "Games / Real-Time",  "color": "#db2777" },
    { "id": "arts",       "label": "Arts / Immersive",   "color": "#ea580c" },
    { "id": "industry",   "label": "Industry / Floor",   "color": "#0d9488" }
  ],
  "accessLevels": ["FCS", "FC", "E", "D"],
  "recommendation": {
    "keywordsBoost": ["digital twin","sensor","simulation","physical ai","robotics",
      "capture","scanning","lidar","real-time rendering","synthetic data",
      "ray tracing","dynamics","neural rendering"],
    "programsBoost": ["Technical Papers","Frontiers","Technical Workshops","Courses",
      "Emerging Technologies","Games Summit","Talks","Real-Time Live!","Exhibition"],
    "programsDemote": ["Art Gallery","Computer Animation Festival"]
  }
}
```
Notes: `recommendation` is the ONLY personalization block. To retarget for a different
attendee or conference, edit this — no code changes. If it's absent, show all sessions
unranked (no recommendations). Keep the profile out of the components.

### `sessions.json` — array of sessions (the standardized session schema)
```json
[
  {
    "id": "unique-string",
    "day": "2026-07-20",              // must match a config.days[].key
    "start": "09:00",                  // 24h local
    "end": "12:15",
    "title": "Technical Papers Session",
    "program": "Technical Papers",     // program/event type
    "track": "research",               // must match a config.tracks[].id
    "speakers": [],                    // optional
    "location": "",                    // room, optional
    "keywords": [],                    // optional; feeds recommendation scoring
    "access": ["FCS","FC"],           // registration access
    "description": "",                 // optional abstract
    "sourceUrl": ""                    // optional deep link back to official page
  }
]
```
Rule: components consume ONLY these fields. Recommendation flag + reason are **computed
at runtime** from `config.recommendation` (score keywords/program hits, attach a
one-line reason like "matches: simulation, sensor"). Do NOT bake a `rec` boolean into
the data — that keeps the dataset conference-neutral.

## Getting SIGGRAPH's real data (data-authoring step, separate from the app)
The official schedule at `https://s2026.conference-schedule.org/` renders sessions
**client-side via JavaScript** — a plain fetch returns only filter scaffolding and a
"No presentations match" placeholder. To populate `sessions.json`:
1. Headless browser (Playwright/Puppeteer): load each day tab (ISO dates `2026-07-19`
   … `2026-07-22`), let JS run, scrape the rendered DOM into the schema above.
2. Or find the JS data feed (Network tab / `wp-json` / a Linklings JSON endpoint) and
   transform it.
Write a small standalone `scripts/scrape.mjs` that outputs `sessions.json` in the schema
— keep it OUT of the app runtime (Pages is static; scraping happens at author time).

### Fallback dataset (use if scraping fails — block granularity, no per-talk titles)
Reg codes: FCS=Full Conf Supporter, FC=Full Conference, E=Experience, D=Discover.
Convert each into schema rows (split multi-block programs into separate sessions).

**Sun 19 Jul**
- Frontiers Workshops — 09:00–12:15, 14:00–17:15 (FCS/FC/E) [research]
- Technical Workshops — 09:00–12:15, 14:00–17:15 (FCS/FC) [research]
- Courses — 09:00–12:15, 14:00–17:15 (FCS/FC) [research]
- Educator's Forum — 09:00–12:15, 14:00–17:15 (FCS/FC/E) [research]
- Industry Sessions — 11:00–12:30, 14:00–17:15 (FCS/FC/E/D) [industry]
- Production Sessions — 11:15–12:15, 16:15–17:15 (FCS/FC) [production]
- ACM SIGGRAPH 365 — 09:00–12:45, 13:00–17:00 (FCS/FC/E) [research]

**Mon 20 Jul**
- Frontiers Talks — 08:00–08:45 (FCS/FC/E) [research]
- SIGGRAPH Keynote — 09:00–10:30 (FCS/FC/E/D) [research]
- Technical Papers Sessions — 09:00–12:15, 14:00–17:15 (FCS/FC) [research]
- Technical Workshops — 09:00–12:15, 14:00–17:15 (FCS/FC) [research]
- Courses — 09:00–10:30, 14:00–17:15 (FCS/FC) [research]
- Games Summit — 10:00–17:15 (FCS/FC/E) [games]
- Emerging Technologies — 10:30–17:00 (FCS/FC/E) [arts]
- Immersive Pavilion — 10:30–17:00 (FCS/FC/E) [arts]
- Art Gallery — 10:30–17:00 (FCS/FC/E) [arts]
- Panels — 10:45–12:15 (FCS/FC) [research]
- Talks — 14:00–17:15 (FCS/FC) [production]
- Real-Time Live! — 18:00–19:45 (FCS/FC) [games]

**Tue 21 Jul**
- Frontiers Talks — 08:00–08:45 (FCS/FC/E) [research]
- Technical Papers Sessions — 09:00–12:15, 14:00–15:30 (FCS/FC) [research]
- Frontiers Workshops — 09:00–12:15 (FCS/FC/E) [research]
- Technical Workshops — 09:00–12:15 (FCS/FC) [research]
- Courses — 09:00–12:15 (FCS/FC) [research]
- Industry Sessions — 09:00–15:00 (FCS/FC/E/D) [industry]
- Exhibition — 10:00–17:00 (FCS/FC/E/D) [industry]  ← floor opens
- Emerging Technologies — 10:00–17:00 (FCS/FC/E) [arts]
- Games Summit — 10:00–17:15 (FCS/FC/E) [games]
- Production Sessions — 09:30–10:30 (FCS/FC) [production]
- Sponsored Keynote — 14:30–15:30 (FCS/FC/E/D) [industry]
- Talks — 15:45–17:35 (FCS/FC) [production]
- Computer Animation Festival: Electronic Theater — 18:30–20:30 (FCS/FC; ticketed E/D) [arts]

**Wed 22 Jul**
- Frontiers Talks — 08:00–08:45 (FCS/FC/E) [research]
- Technical Papers Sessions — 09:00–12:15, 14:00–17:15 (FCS/FC) [research]
- Courses — 09:00–12:15, 14:00–17:15 (FCS/FC) [research]
- Technical Workshops — 09:00–12:15, 14:00–17:15 (FCS/FC) [research]
- Industry Sessions — 09:00–16:50 (FCS/FC/E/D) [industry]
- Exhibition — 10:00–17:00 (FCS/FC/E/D) [industry]
- Emerging Technologies — 10:00–17:00 (FCS/FC/E) [arts]
- Games Summit — 10:00–17:15 (FCS/FC/E) [games]
- Immersive Pavilion — 10:00–17:00 (FCS/FC/E) [arts]
- Panels — 10:45–12:15 (FCS/FC) [research]
- Production Sessions — 09:30–10:30, 11:15–12:15 (FCS/FC) [production]
- Sponsored Keynote — 14:30–15:30 (FCS/FC/E/D) [industry]
- Talks — 14:00–17:15 (FCS/FC) [production]
- Computer Animation Festival: Electronic Theater — 18:30–20:30 (FCS/FC; ticketed E/D) [arts]

## App features (build these)
- **Day tabs** from `config.days`, each showing count of selected sessions that day.
- **Filters**: by track (from config), by program type (derived from data), plus a
  "recommended only" toggle. Optional: filter by access level.
- **Select/deselect** sessions → persisted to localStorage per conference.
- **Conflict detection**: highlight selected sessions whose times overlap on a day.
- **Recommendations**: computed at runtime from `config.recommendation`; show a green
  marker + one-line reason. "Add day's picks" bulk-adds a day's recommended sessions.
- **Calendar export**: generate a `.ics` from selected sessions (VEVENT per session,
  correct TZID from config.timezone). This is the payoff feature.
- **Empty/offline states**: clear copy when filters match nothing or when offline.

## UX to reuse (already prototyped)
A React prototype exists at block granularity: sticky day tabs, colored track chips,
tap-to-select cards with a check state, live conflict highlighting in red, a
"recommended only" toggle, and per-day "add all picks". Keep that interaction model;
the new work is: generic data loading, PWA + offline, GitHub Pages deploy, and .ics export.

## Repo shape (suggested)
```
/  (Vite root)
  index.html
  vite.config.js            # base: '/<repo>/', vite-plugin-pwa configured
  package.json
  public/
    manifest.webmanifest    # or generated by the plugin
    icons/                  # 192 + 512 PWA icons
    data/config.json        # swappable per conference
    data/sessions.json
  src/
    App.jsx, components/, lib/ (scoring, ics, storage, overlap)
  scripts/scrape.mjs        # author-time data fetch (Playwright)
  .github/workflows/deploy.yml
  README.md                 # documents the schedule schema for other conferences
```

## Deliverable
A runnable Vite + React PWA that deploys to GitHub Pages via Actions, works offline,
stores each user's agenda locally, and is driven entirely by `config.json` +
`sessions.json` so any conference can fork it, drop in their own two files, and ship.
Ship it first populated with the SIGGRAPH 2026 Sun–Wed data (scraped if possible,
fallback blocks otherwise), plus a README explaining the schema and the fork workflow.
