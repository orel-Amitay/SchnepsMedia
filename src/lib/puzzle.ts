import { getGraph, getStation } from './graph'
import { findMinLinePath } from './pathfind'
import { dateKeyUTC, hashString, mulberry32 } from './rng'
import type { Puzzle } from './types'

/** Daily format: always 3 trains / 2 transfers */
const REQUIRED_LINES = 3
const MIN_HOPS = 6

function isInteresting(puzzle: Puzzle): boolean {
  if (puzzle.solution.length !== REQUIRED_LINES) return false
  if (puzzle.pathStationIds.length < MIN_HOPS) return false
  for (let i = 1; i < puzzle.solution.length; i++) {
    if (puzzle.solution[i] === puzzle.solution[i - 1]) return false
  }
  const origin = getStation(puzzle.originId)
  const dest = getStation(puzzle.destinationId)
  if (!origin || !dest) return false
  const dist = Math.hypot(origin.lat - dest.lat, origin.lon - dest.lon)
  return dist > 0.05
}

/** Build a deterministic puzzle from any seed string. */
export function getPuzzleForSeed(seed: string): Puzzle {
  const rng = mulberry32(hashString(`transfer-nyc:${seed}`))
  const stations = getGraph().stations.filter((s) => s.lines.length > 0)

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
    if (isInteresting(puzzle)) return puzzle
  }

  const fallbacks: Array<[string, string]> = [
    ['A41', 'G08'],
    ['A40', 'G14'],
    ['132', 'G08'],
    ['R31', '718'],
    ['A27', 'D43'],
    ['235', 'F01'],
  ]
  for (const [o, d] of fallbacks) {
    const path = findMinLinePath(o, d)
    if (path && path.lines.length === REQUIRED_LINES) {
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
    if (path && path.lines.length === REQUIRED_LINES) {
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
    solution: ['A', 'L', '1'],
    pathStationIds: [stations[0]!.id, stations[1]!.id],
  }
}

export function getDailyPuzzle(date = new Date()): Puzzle {
  return getPuzzleForSeed(dateKeyUTC(date))
}

export function getPracticePuzzle(nonce = Date.now()): Puzzle {
  return getPuzzleForSeed(`practice:${nonce}`)
}

export function isPracticePuzzle(puzzle: Puzzle): boolean {
  return puzzle.dateKey.startsWith('practice:')
}
