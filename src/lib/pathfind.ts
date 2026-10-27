import { getNeighbors } from './graph'
import type { LineId, StationId } from './types'

export type LinePath = {
  lines: LineId[]
  stations: StationId[]
}

type State = {
  station: StationId
  line: LineId | null
  lines: LineId[]
  stations: StationId[]
}

/**
 * Find a minimum-transfer ride between two stations.
 * Cost is the number of boarded lines (not walking transfers).
 */
export function findMinLinePath(
  origin: StationId,
  destination: StationId,
): LinePath | null {
  if (origin === destination) return { lines: [], stations: [origin] }

  const queue: State[] = [{ station: origin, line: null, lines: [], stations: [origin] }]
  // Best (fewest lines, then fewest stations) seen for (station|line)
  const best = new Map<string, { lineCount: number; hopCount: number }>()
  best.set(`${origin}|`, { lineCount: 0, hopCount: 0 })

  let found: LinePath | null = null

  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur.station === destination) {
      found = { lines: cur.lines, stations: cur.stations }
      break
    }

    for (const n of getNeighbors(cur.station)) {
      if (n.walk || n.lines.length === 0) {
        // Walking transfer between complexes: keep current line context
        const key = `${n.to}|${cur.line ?? ''}`
        const lineCount = cur.lines.length
        const hopCount = cur.stations.length
        const prev = best.get(key)
        if (prev && (prev.lineCount < lineCount || (prev.lineCount === lineCount && prev.hopCount <= hopCount))) {
          continue
        }
        best.set(key, { lineCount, hopCount })
        queue.push({
          station: n.to,
          line: cur.line,
          lines: cur.lines,
          stations: [...cur.stations, n.to],
        })
        continue
      }

      for (const rideLine of n.lines) {
        const same = cur.line === rideLine
        const nextLines = same ? cur.lines : [...cur.lines, rideLine]
        // Bound puzzle length
        if (nextLines.length > 6) continue

        const key = `${n.to}|${rideLine}`
        const lineCount = nextLines.length
        const hopCount = cur.stations.length
        const prev = best.get(key)
        if (prev && (prev.lineCount < lineCount || (prev.lineCount === lineCount && prev.hopCount <= hopCount))) {
          continue
        }
        best.set(key, { lineCount, hopCount })

        // Prefer continuing on same line (BFS by line count via bucketed queue would be ideal;
        // here we push same-line moves to front to bias continuity)
        const next: State = {
          station: n.to,
          line: rideLine,
          lines: nextLines,
          stations: [...cur.stations, n.to],
        }
        if (same) queue.unshift(next)
        else queue.push(next)
      }
    }
  }

  return found
}
