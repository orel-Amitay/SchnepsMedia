import { getNeighbors, getStation } from './graph'
import type { LineId, StationId } from './types'

/**
 * True if there is a path origin → destination that rides `lines` in order
 * (transferring between consecutive lines, walks allowed between complexes).
 */
export function isValidTrip(origin: StationId, destination: StationId, lines: LineId[]): boolean {
  if (lines.length === 0) return origin === destination
  for (const line of lines) {
    if (!line) return false
  }

  // State: station + which leg we're riding
  type Node = { station: StationId; leg: number }
  const start: Node = { station: origin, leg: 0 }
  const seen = new Set<string>()
  const queue: Node[] = [start]
  seen.add(`${origin}|0`)

  while (queue.length > 0) {
    const cur = queue.shift()!
    const ride = lines[cur.leg]!

    if (cur.station === destination && cur.leg === lines.length - 1) {
      // Must be able to be "on" the last line at destination (served by it or walked onto complex)
      const dest = getStation(destination)
      if (dest?.lines.includes(ride) || cur.leg === lines.length - 1) return true
    }

    for (const n of getNeighbors(cur.station)) {
      if (n.walk || n.lines.length === 0) {
        const key = `${n.to}|${cur.leg}`
        if (seen.has(key)) continue
        seen.add(key)
        queue.push({ station: n.to, leg: cur.leg })
        continue
      }

      // Continue on current line
      if (n.lines.includes(ride)) {
        const key = `${n.to}|${cur.leg}`
        if (!seen.has(key)) {
          seen.add(key)
          queue.push({ station: n.to, leg: cur.leg })
        }
      }

      // Transfer to next line at this station (or after walk) — only forward
      if (cur.leg < lines.length - 1) {
        const nextLine = lines[cur.leg + 1]!
        const here = getStation(cur.station)
        const canTransfer =
          (here?.lines.includes(ride) && here.lines.includes(nextLine)) ||
          n.lines.includes(nextLine)
        if (canTransfer && n.lines.includes(nextLine)) {
          const key = `${n.to}|${cur.leg + 1}`
          if (!seen.has(key)) {
            seen.add(key)
            queue.push({ station: n.to, leg: cur.leg + 1 })
          }
        }
        // Transfer in place (same complex) then leave on next line later
        if (here?.lines.includes(ride) && here.lines.includes(nextLine)) {
          const key = `${cur.station}|${cur.leg + 1}`
          if (!seen.has(key)) {
            seen.add(key)
            queue.push({ station: cur.station, leg: cur.leg + 1 })
          }
        }
      }
    }

    // Also allow boarding first line via walk-from-origin style: if origin doesn't have line,
    // walks already expand. For destination check when on last leg:
    if (cur.station === destination && cur.leg === lines.length - 1) return true
  }

  return false
}
