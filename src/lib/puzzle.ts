import { getGraph, getStation } from './graph'
import { findMinLinePath } from './pathfind'
import { dateKeyUTC, hashString, mulberry32 } from './rng'
import type { Puzzle } from './types'

const MIN_LINES = 2
const MAX_LINES = 4
const MIN_HOPS = 4

function isInteresting(puzzle: Puzzle): boolean {
  const n = puzzle.solution.length
  if (n < MIN_LINES || n > MAX_LINES) return false
  if (puzzle.pathStationIds.length < MIN_HOPS) return false
  // Avoid duplicate consecutive lines (shouldn't happen)
  for (let i = 1; i < puzzle.solution.length; i++) {
    if (puzzle.solution[i] === puzzle.solution[i - 1]) return false
  }
  const origin = getStation(puzzle.originId)
  const dest = getStation(puzzle.destinationId)
  if (!origin || !dest) return false
  // Prefer distinct boroughs roughly by longitude/latitude spread
  const dist =
    Math.hypot(origin.lat - dest.lat, origin.lon - dest.lon)
  return dist > 0.04
}

export function getDailyPuzzle(date = new Date()): Puzzle {
  const key = dateKeyUTC(date)
  const rng = mulberry32(hashString(`subwaydle-nyc:${key}`))
  const stations = getGraph().stations.filter((s) => s.lines.length > 0)

  // Deterministic search with date seed — try many pairs until interesting route found
  for (let attempt = 0; attempt < 2500; attempt++) {
    const a = stations[Math.floor(rng() * stations.length)]!
    const b = stations[Math.floor(rng() * stations.length)]!
    if (a.id === b.id) continue

    const path = findMinLinePath(a.id, b.id)
    if (!path || path.lines.length === 0) continue

    const puzzle: Puzzle = {
      dateKey: key,
      originId: a.id,
      destinationId: b.id,
      solution: path.lines,
      pathStationIds: path.stations,
    }
    if (isInteresting(puzzle)) return puzzle
  }

  // Fallback: fixed well-known route if seed search fails
  const fallbackPath = findMinLinePath('127', 'D20') // Times Sq-42 St → Brighton Beach area-ish
  // Try a few famous pairs
  const fallbacks: Array<[string, string]> = [
    ['127', 'A32'], // Times Sq → W 4 St
    ['132', 'R31'], // 14 St-Union Sq → Atlantic Av-Barclays
    ['A27', 'G22'], // 42 St-Port Authority → Court Sq
    ['235', '718'], // Brooklyn → Queens attempt
  ]
  for (const [o, d] of fallbacks) {
    const path = findMinLinePath(o, d)
    if (path && path.lines.length >= 2) {
      return {
        dateKey: key,
        originId: o,
        destinationId: d,
        solution: path.lines,
        pathStationIds: path.stations,
      }
    }
  }

  return {
    dateKey: key,
    originId: stations[0]!.id,
    destinationId: stations[1]!.id,
    solution: fallbackPath?.lines ?? ['1', '2'],
    pathStationIds: fallbackPath?.stations ?? [stations[0]!.id, stations[1]!.id],
  }
}
