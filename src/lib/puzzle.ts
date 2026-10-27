import { getStationsInScope, normalizeRouteScope, stationIdsInScope, type RouteScope } from './boroughs'
import { getStation } from './graph'
import { findMinLinePath } from './pathfind'
import { dateKeyUTC, hashString, mulberry32 } from './rng'
import type { Puzzle } from './types'

/** Daily format: always 3 trains / 2 transfers */
const REQUIRED_LINES = 3
const MIN_HOPS = 6

/** Daily puzzle stays Manhattan-only so everyone shares the same board. */
export const DAILY_ROUTE_SCOPE: RouteScope = 'manhattan'

function isInteresting(puzzle: Puzzle, allowed: Set<string>): boolean {
  if (puzzle.solution.length !== REQUIRED_LINES) return false
  if (puzzle.pathStationIds.length < MIN_HOPS) return false
  for (let i = 1; i < puzzle.solution.length; i++) {
    if (puzzle.solution[i] === puzzle.solution[i - 1]) return false
  }
  for (const id of puzzle.pathStationIds) {
    if (!allowed.has(id)) return false
  }
  const origin = getStation(puzzle.originId)
  const dest = getStation(puzzle.destinationId)
  if (!origin || !dest) return false
  const dist = Math.hypot(origin.lat - dest.lat, origin.lon - dest.lon)
  return dist > 0.04
}

const MANHATTAN_FALLBACKS: Array<[string, string]> = [
  ['127', 'A02'], // Times Sq → Inwood-207
  ['A28', '631'], // 34 St-Penn → Grand Central
  ['635', 'A02'], // Union Sq → Inwood
  ['142', '120'], // South Ferry → 96 St
  ['A34', '116'], // Canal St → 125 St
  ['137', 'B08'], // Chambers → Lex/63
  ['128', 'A19'], // Penn → 96 St (2/3 / A/B/C)
  ['R20', 'A17'], // Union Sq → Cathedral Pkwy
]

const CITYWIDE_FALLBACKS: Array<[string, string]> = [
  ['A41', 'G08'],
  ['A40', 'G14'],
  ['132', 'G08'],
  ['R31', '718'],
  ['A27', 'D43'],
  ['235', 'F01'],
]

/** Build a deterministic puzzle from any seed string. */
export function getPuzzleForSeed(seed: string, scope: RouteScope = 'manhattan'): Puzzle {
  const routeScope = normalizeRouteScope(scope)
  // Keep legacy daily seeds stable; practice seeds include scope so Manhattan ≠ All NYC.
  const hashKey = seed.startsWith('practice:')
    ? `transfer-nyc:${routeScope}:${seed}`
    : `transfer-nyc:${seed}`
  const rng = mulberry32(hashString(hashKey))
  const stations = getStationsInScope(routeScope)
  const allowed = stationIdsInScope(routeScope)

  for (let attempt = 0; attempt < 2500; attempt++) {
    const a = stations[Math.floor(rng() * stations.length)]!
    const b = stations[Math.floor(rng() * stations.length)]!
    if (a.id === b.id) continue

    const path = findMinLinePath(a.id, b.id)
    if (!path || path.lines.length === 0) continue

    const puzzle: Puzzle = {
      dateKey: seed,
      originId: a.id,
      destinationId: b.id,
      solution: path.lines,
      pathStationIds: path.stations,
    }
    if (isInteresting(puzzle, allowed)) return puzzle
  }

  const fallbacks = routeScope === 'manhattan' ? MANHATTAN_FALLBACKS : CITYWIDE_FALLBACKS
  for (const [o, d] of fallbacks) {
    if (!allowed.has(o) || !allowed.has(d)) continue
    const path = findMinLinePath(o, d)
    if (path && path.lines.length === REQUIRED_LINES && path.stations.every((id) => allowed.has(id))) {
      return {
        dateKey: seed,
        originId: o,
        destinationId: d,
        solution: path.lines,
        pathStationIds: path.stations,
      }
    }
  }

  for (let attempt = 0; attempt < 800; attempt++) {
    const a = stations[Math.floor(rng() * stations.length)]!
    const b = stations[Math.floor(rng() * stations.length)]!
    if (a.id === b.id) continue
    const path = findMinLinePath(a.id, b.id)
    if (
      path &&
      path.lines.length === REQUIRED_LINES &&
      path.stations.every((id) => allowed.has(id))
    ) {
      return {
        dateKey: seed,
        originId: a.id,
        destinationId: b.id,
        solution: path.lines,
        pathStationIds: path.stations,
      }
    }
  }

  return {
    dateKey: seed,
    originId: stations[0]!.id,
    destinationId: stations[Math.min(20, stations.length - 1)]!.id,
    solution: ['A', 'C', '1'],
    pathStationIds: [stations[0]!.id, stations[1]!.id],
  }
}

export function getDailyPuzzle(date = new Date()): Puzzle {
  // Seed stays date-only (no scope) so the shared daily board is stable.
  return getPuzzleForSeed(dateKeyUTC(date), DAILY_ROUTE_SCOPE)
}

export function getPracticePuzzle(nonce = Date.now(), scope: RouteScope = 'manhattan'): Puzzle {
  return getPuzzleForSeed(`practice:${nonce}`, normalizeRouteScope(scope))
}

export function isPracticePuzzle(puzzle: Puzzle): boolean {
  return puzzle.dateKey.startsWith('practice:')
}
