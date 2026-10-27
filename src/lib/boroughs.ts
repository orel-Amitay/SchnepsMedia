import { getGraph, getPlayableLines } from './graph'
import type { LineId, Station, StationId } from './types'

/** Where new routes / practice puzzles may go. Daily is always Manhattan. */
export type RouteScope = 'manhattan' | 'all'

export const ROUTE_SCOPE_LABEL: Record<RouteScope, string> = {
  manhattan: 'Manhattan',
  all: 'All NYC',
}

/**
 * Simplified Manhattan outline (lon, lat) — subway-station precision.
 * Keeps Roosevelt Island / Battery / Inwood; excludes LIC, Brooklyn, Bronx yards.
 */
const MANHATTAN_POLY: Array<[number, number]> = [
  [-74.047, 40.69],
  [-74.005, 40.7],
  [-73.99, 40.705],
  [-73.972, 40.712],
  [-73.968, 40.73],
  [-73.96, 40.745],
  [-73.945, 40.76],
  [-73.928, 40.78],
  [-73.92, 40.8],
  [-73.91, 40.83],
  [-73.91, 40.87],
  [-73.92, 40.878],
  [-73.935, 40.882],
  [-73.945, 40.875],
  [-73.965, 40.865],
  [-73.99, 40.85],
  [-74.01, 40.82],
  [-74.02, 40.78],
  [-74.025, 40.75],
  [-74.025, 40.72],
  [-74.02, 40.7],
]

function pointInPoly(lon: number, lat: number, poly: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function isManhattanStation(station: Pick<Station, 'lat' | 'lon'>): boolean {
  return pointInPoly(station.lon, station.lat, MANHATTAN_POLY)
}

export function isStationInScope(station: Station, scope: RouteScope): boolean {
  if (scope === 'all') return true
  return isManhattanStation(station)
}

export function getStationsInScope(scope: RouteScope): Station[] {
  return getGraph().stations.filter((s) => s.lines.length > 0 && isStationInScope(s, scope))
}

export function stationIdsInScope(scope: RouteScope): Set<StationId> {
  return new Set(getStationsInScope(scope).map((s) => s.id))
}

/** Lines that actually stop in the selected area (for the keyboard). */
export function getPlayableLinesForScope(scope: RouteScope): LineId[] {
  const all = getPlayableLines()
  if (scope === 'all') return all
  const used = new Set<LineId>()
  for (const s of getStationsInScope('manhattan')) {
    for (const line of s.lines) used.add(line)
  }
  return all.filter((id) => used.has(id))
}

export function normalizeRouteScope(value: unknown): RouteScope {
  return value === 'all' ? 'all' : 'manhattan'
}
