#!/usr/bin/env node
/**
 * Rebuild src/data/graph.json from MTA subway GTFS.
 * Usage: node scripts/build-graph.mjs [path/to/gtfs_dir]
 * Default download: https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '../src/data/graph.json')

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const cols = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        inQ = !inQ
        continue
      }
      if (c === ',' && !inQ) {
        cols.push(cur)
        cur = ''
        continue
      }
      cur += c
    }
    cols.push(cur)
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? ''
    })
    return obj
  })
}

function ensureGtfsDir(arg) {
  if (arg && fs.existsSync(arg)) return arg
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtfs-subway-'))
  const zip = path.join(dir, 'gtfs_subway.zip')
  execSync(`curl -fsSL -o "${zip}" https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip`, {
    stdio: 'inherit',
  })
  execSync(`unzip -o "${zip}" -d "${dir}"`, { stdio: 'inherit' })
  return dir
}

const gtfsDir = ensureGtfsDir(process.argv[2])
const routes = parseCsv(fs.readFileSync(path.join(gtfsDir, 'routes.txt'), 'utf8'))
const stops = parseCsv(fs.readFileSync(path.join(gtfsDir, 'stops.txt'), 'utf8'))
const trips = parseCsv(fs.readFileSync(path.join(gtfsDir, 'trips.txt'), 'utf8'))
const transfers = parseCsv(fs.readFileSync(path.join(gtfsDir, 'transfers.txt'), 'utf8'))

const stations = {}
for (const s of stops) {
  if (s.location_type === '1') {
    stations[s.stop_id] = {
      id: s.stop_id,
      name: s.stop_name,
      lat: +s.stop_lat,
      lon: +s.stop_lon,
      lines: new Set(),
    }
  }
}

const parentOf = {}
for (const s of stops) {
  if (s.parent_station) parentOf[s.stop_id] = s.parent_station
  else if (s.location_type === '1') parentOf[s.stop_id] = s.stop_id
}

const tripRoute = {}
for (const t of trips) tripRoute[t.trip_id] = t.route_id

const tripStops = new Map()
for (const line of fs.readFileSync(path.join(gtfsDir, 'stop_times.txt'), 'utf8').trim().split(/\r?\n/).slice(1)) {
  const [trip_id, stop_id, , , stop_sequence] = line.split(',')
  const parent = parentOf[stop_id]
  if (!parent || !stations[parent]) continue
  if (!tripStops.has(trip_id)) tripStops.set(trip_id, [])
  tripStops.get(trip_id).push({ seq: +stop_sequence, parent })
}

const adj = new Map()
const ensure = (id) => {
  if (!adj.has(id)) adj.set(id, new Map())
  return adj.get(id)
}

for (const [trip_id, stopsArr] of tripStops) {
  const route = tripRoute[trip_id]
  if (!route || route === 'SI') continue
  stopsArr.sort((a, b) => a.seq - b.seq)
  const seq = []
  for (const s of stopsArr) {
    if (seq.length === 0 || seq[seq.length - 1] !== s.parent) seq.push(s.parent)
  }
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i]
    const b = seq[i + 1]
    stations[a].lines.add(route)
    stations[b].lines.add(route)
    for (const [u, v] of [
      [a, b],
      [b, a],
    ]) {
      const m = ensure(u)
      if (!m.has(v)) m.set(v, new Set())
      m.get(v).add(route)
    }
  }
}

for (const t of transfers) {
  const a = parentOf[t.from_stop_id] || t.from_stop_id
  const b = parentOf[t.to_stop_id] || t.to_stop_id
  if (a === b || !stations[a] || !stations[b]) continue
  ensure(a)
  if (!adj.get(a).has(b)) adj.get(a).set(b, new Set())
  adj.get(a).get(b).add('WALK')
  ensure(b)
  if (!adj.get(b).has(a)) adj.get(b).set(a, new Set())
  adj.get(b).get(a).add('WALK')
}

const outStations = Object.values(stations)
  .map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    lines: [...s.lines].sort(),
  }))
  .filter((s) => s.lines.length > 0)

const edges = []
for (const [from, neighbors] of adj) {
  for (const [to, lines] of neighbors) {
    if (from < to) {
      edges.push({
        from,
        to,
        lines: [...lines].filter((l) => l !== 'WALK').sort(),
        walk: [...lines].includes('WALK'),
      })
    }
  }
}

const graph = {
  generatedFrom: 'MTA GTFS subway static feed (https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip)',
  routes: routes
    .filter((r) => r.route_id !== 'SI')
    .map((r) => ({
      id: r.route_id,
      name: r.route_short_name || r.route_id,
      color: `#${r.route_color || '808183'}`,
      textColor: `#${r.route_text_color || 'FFFFFF'}`,
    })),
  stations: outStations,
  edges,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(graph))
console.log(`Wrote ${outPath} (${outStations.length} stations, ${edges.length} edges)`)
