import type { LineId } from './types'

/**
 * Approximate NYC "shared routing" families for blue feedback.
 * Inspired by subwaydle.com: another train that often shares the same tracks/stops.
 */
const GROUPS: LineId[][] = [
  ['1', '2', '3'],
  ['4', '5', '6', '6X'],
  ['7', '7X'],
  ['A', 'C', 'E'],
  ['B', 'D', 'F', 'M', 'FX'],
  ['N', 'Q', 'R', 'W'],
  ['J', 'Z'],
  ['G'],
  ['L'],
  ['GS', 'FS', 'H'],
]

const groupOf = new Map<LineId, number>()
GROUPS.forEach((g, i) => g.forEach((line) => groupOf.set(line, i)))

export function sharesRouting(a: LineId, b: LineId): boolean {
  if (a === b) return true
  const ga = groupOf.get(a)
  const gb = groupOf.get(b)
  return ga !== undefined && ga === gb
}
