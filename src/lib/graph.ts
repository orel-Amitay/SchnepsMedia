import raw from '../data/graph.json'
import type { LineId, Station, StationId, SubwayGraph } from './types'

const graph = raw as SubwayGraph

export type Neighbor = {
  to: StationId
  lines: LineId[]
  walk: boolean
}

const stationById = new Map<StationId, Station>()
const routeById = new Map(graph.routes.map((r) => [r.id, r]))
const adjacency = new Map<StationId, Neighbor[]>()

for (const s of graph.stations) {
  stationById.set(s.id, s)
  adjacency.set(s.id, [])
}

for (const e of graph.edges) {
  adjacency.get(e.from)?.push({ to: e.to, lines: e.lines, walk: e.walk })
  adjacency.get(e.to)?.push({ to: e.from, lines: e.lines, walk: e.walk })
}

export function getGraph(): SubwayGraph {
  return graph
}

export function getStation(id: StationId): Station | undefined {
  return stationById.get(id)
}

export function getRoute(id: LineId) {
  return routeById.get(id)
}

export function getAllRoutes() {
  return graph.routes
}

export function getNeighbors(id: StationId): Neighbor[] {
  return adjacency.get(id) ?? []
}

export function getPlayableLines(): LineId[] {
  // Exclude obscure shuttles that confuse players; keep main letter/number lines + GS
  const skip = new Set(['FS', 'H'])
  return graph.routes
    .map((r) => r.id)
    .filter((id) => !skip.has(id))
    .sort((a, b) => {
      const rank = (x: string) => {
        if (/^\d/.test(x)) return `0${x}`
        if (x.length > 1) return `2${x}`
        return `1${x}`
      }
      return rank(a).localeCompare(rank(b))
    })
}
