#!/usr/bin/env node
/**
 * Offline format checker — validates conference bundles against the
 * SessionSamba format (SPEC.md sect. 3–4) using the SAME rules the app
 * applies at runtime (src/lib/validate.js), so data that passes here loads.
 *
 * Usage:
 *   node scripts/check_bundle.mjs                 # check every folder under public/data/
 *   node scripts/check_bundle.mjs bundle.json     # check a single-file bundle
 *   node scripts/check_bundle.mjs path/to/folder  # check a config.json + sessions.json folder
 *
 * Exits 1 if anything fails, so it can gate CI.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { validateBundle, checkBundle } from '../src/lib/validate.js'

const read = (p) => JSON.parse(readFileSync(p, 'utf8'))
let failures = 0

function report(label, config, sessions) {
  const issues = checkBundle(config, sessions)
  if (issues.length) {
    failures += issues.length
    console.log(`FAIL  ${label} — ${issues.length} issue(s):`)
    for (const issue of issues) console.log(`        ${issue}`)
  } else {
    console.log(`ok    ${label} (${sessions.length} sessions)`)
  }
}

function checkTarget(target) {
  if (statSync(target).isDirectory()) {
    const config = read(join(target, 'config.json'))
    const sessions = read(join(target, 'sessions.json'))
    report(target, config, sessions)
    return
  }
  const v = validateBundle(read(target))
  if (!v.ok) {
    failures++
    console.log(`FAIL  ${target} — ${v.error}`)
    return
  }
  report(target, v.config, v.sessions)
}

const args = process.argv.slice(2)
if (args.length) {
  for (const target of args) checkTarget(target)
} else {
  // Default: every bundled conference, plus manifest consistency.
  const dataDir = 'public/data'
  const manifest = read(join(dataDir, 'index.json'))
  const folders = readdirSync(dataDir).filter((f) => existsSync(join(dataDir, f, 'config.json')))
  for (const folder of folders) checkTarget(join(dataDir, folder))
  for (const entry of manifest.conferences ?? []) {
    const cfgPath = join(dataDir, entry.path, 'config.json')
    if (!existsSync(cfgPath)) {
      failures++
      console.log(`FAIL  index.json lists "${entry.id}" at ${entry.path}/ but that folder has no config.json`)
      continue
    }
    const cfg = read(cfgPath)
    if (cfg.conferenceId !== entry.id) {
      failures++
      console.log(`FAIL  index.json id "${entry.id}" != ${entry.path}/config.json conferenceId "${cfg.conferenceId}"`)
    }
  }
  const listed = new Set((manifest.conferences ?? []).map((c) => c.path))
  for (const folder of folders) {
    if (!listed.has(folder)) {
      failures++
      console.log(`FAIL  ${folder}/ has a config.json but is missing from index.json — run: npm run rebuild:index`)
    }
  }
}

process.exit(failures ? 1 : 0)
