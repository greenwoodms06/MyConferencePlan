#!/usr/bin/env node
/**
 * Regenerate public/data/index.json (the conference manifest the app's
 * switcher reads) from every folder that holds a config.json.
 * Run after adding or editing a bundled conference.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dataDir = 'public/data'
const conferences = []

for (const folder of readdirSync(dataDir).sort()) {
  const cfgPath = join(dataDir, folder, 'config.json')
  if (!existsSync(cfgPath)) continue
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
  conferences.push({
    id: cfg.conferenceId,
    name: cfg.name,
    path: folder,
    accent: cfg.accent ?? '#3d5af1',
    dateRange: cfg.dateRange ?? '',
    location: cfg.shortLocation || cfg.location || '',
    dataVersion: cfg.dataVersion ?? '',
  })
}

const manifest = { schemaVersion: 1, conferences }
writeFileSync(join(dataDir, 'index.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Wrote ${dataDir}/index.json (${conferences.length} conference${conferences.length === 1 ? '' : 's'})`)
