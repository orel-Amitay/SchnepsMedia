import { getStationsInScope, normalizeRouteScope, stationIdsInScope, type RouteScope } from './boroughs'
import { getStation } from './graph'
import { findMinLinePath } from './pathfind'
import { dateKeyUTC, hashString, mulberry32 } from './rng'
import type { Puzzle } from './types'

/** How many trains in the solution (1 = direct, 2 = one transfer, 3 = two transfers). */
export type LineCount = 1 | 2 | 3

/** Daily format: always 3 trains / 2 transfers, Manhattan-only. */
export const DAILY_LINE_COUNT: LineCount = 3
export const DAILY_ROUTE_SCOPE: RouteScope = 'manhattan'

export const LINE_COUNT_OPTIONS: LineCount[] = [1, 2, 3]

export function normalizeLineCount(value: unknown): LineCount {
  const n = typeof value === 'number' ? value : Number(value)
  if (n === 1 || n === 2 || n === 3) return n
  return 3
}

export function lineCountLabel(count: LineCount): string {
  if (count === 1) return 'Direct'
  return `${count} lines`
}

function minHopsFor(count: LineCount): number {
  if (count === 1) return 5
  if (count === 2) return 5
  return 6
}

function minDistFor(count: LineCount): number {
  if (count === 1) return 0.03
  if (count === 2) return 0.035
  return 0.04
}

function isInteresting(puzzle: Puzzle, allowed: Set<string>, lineCount: LineCount): boolean {
  if (puzzle.solution.length !== lineCount) return false
  if (puzzle.pathStationIds.length < minHopsFor(lineCount)) return false
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
  return dist > minDistFor(lineCount)
}

const MANHATTAN_FALLBACKS: Record<LineCount, Array<[string, string]>> = {
  1: [
    ['142', '127'], // South Ferry → Times Sq (1)
    ['A02', 'A28'], // Inwood → Penn (A)
    ['120', '142'], // 96 St → South Ferry
    ['635', '631'], // Union Sq → Grand Central (4/5/6)
    ['A34', 'A19'], // Canal → 96 St (A/C/B)
  ],
  2: [
    ['142', 'A02'],
    ['635', 'A28'],
    ['127', 'A19'],
    ['137', '120'],
    ['R20', 'A02'],
  ],
  3: [
    ['127', 'A02'],
    ['A28', '631'],
    ['635', 'A02'],
    ['142', '120'],
    ['A34', '116'],
    ['137', 'B08'],
    ['128', 'A19'],
    ['R20', 'A17'],
  ],
}

const CITYWIDE_FALLBACKS: Record<LineCount, Array<[string, string]>> = {
  1: [
    ['A41', 'A27'],
    ['D43', 'D14'],
    ['G14', 'G08'],
  ],
  2: [
    ['A41', 'G08'],
    ['R31', '718'],
    ['235', 'F01'],
  ],
  3: [
    ['A41', 'G08'],
    ['A40', 'G14'],
    ['132', 'G08'],
    ['R31', '718'],
    ['A27', 'D43'],
    ['235', 'F01'],
  ],
}

export type PuzzleOptions = {
  scope?: RouteScope
  lineCount?: LineCount
}

/** Build a deterministic puzzle from any seed string. */
export function getPuzzleForSeed(seed: string, options: PuzzleOptions = {}): Puzzle {
  const routeScope = normalizeRouteScope(options.scope ?? 'manhattan')
  const lineCount = normalizeLineCount(options.lineCount ?? 3)
  // Keep legacy daily seeds stable; practice seeds include scope + line count.
  const hashKey = seed.startsWith('practice:')
    ? `transfer-nyc:${routeScope}:L${lineCount}:${seed}`
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
    if (isInteresting(puzzle, allowed, lineCount)) return puzzle
  }

  const fallbacks =
    routeScope === 'manhattan' ? MANHATTAN_FALLBACKS[lineCount] : CITYWIDE_FALLBACKS[lineCount]
  for (const [o, d] of fallbacks) {
    if (!allowed.has(o) || !allowed.has(d)) continue
    const path = findMinLinePath(o, d)
    if (
      path &&
      path.lines.length === lineCount &&
      path.stations.every((id) => allowed.has(id))
    ) {
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
      path.lines.length === lineCount &&
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

  const fallbackSolution =
    lineCount === 1 ? (['1'] as const) : lineCount === 2 ? (['A', '1'] as const) : (['A', 'C', '1'] as const)

  return {
    dateKey: seed,
    originId: stations[0]!.id,
    destinationId: stations[Math.min(20, stations.length - 1)]!.id,
    solution: [...fallbackSolution],
    pathStationIds: [stations[0]!.id, stations[1]!.id],
  }
}

export function getDailyPuzzle(date = new Date()): Puzzle {
  return getPuzzleForSeed(dateKeyUTC(date), {
    scope: DAILY_ROUTE_SCOPE,
    lineCount: DAILY_LINE_COUNT,
  })
}

export function getPracticePuzzle(
  nonce = Date.now(),
  scope: RouteScope = 'manhattan',
  lineCount: LineCount = 3,
): Puzzle {
  return getPuzzleForSeed(`practice:${nonce}`, {
    scope: normalizeRouteScope(scope),
    lineCount: normalizeLineCount(lineCount),
  })
}

export function isPracticePuzzle(puzzle: Puzzle): boolean {
  return puzzle.dateKey.startsWith('practice:')
}
