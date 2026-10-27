export type LineId = string
export type StationId = string

export type RouteInfo = {
  id: LineId
  name: string
  color: string
  textColor: string
}

export type Station = {
  id: StationId
  name: string
  lat: number
  lon: number
  lines: LineId[]
}

export type GraphEdge = {
  from: StationId
  to: StationId
  lines: LineId[]
  walk: boolean
}

export type SubwayGraph = {
  generatedFrom: string
  routes: RouteInfo[]
  stations: Station[]
  edges: GraphEdge[]
}

/** correct=green, shared=blue (same routing family), present=yellow, absent=gray */
export type TileStatus = 'correct' | 'shared' | 'present' | 'absent' | 'empty' | 'pending'

export type Puzzle = {
  dateKey: string
  originId: StationId
  destinationId: StationId
  solution: LineId[]
  pathStationIds: StationId[]
}

export type GuessResult = {
  guess: LineId[]
  statuses: TileStatus[]
}

export type Settings = {
  showStatusBadges: boolean
  darkMode: boolean
  /** Practice / New route area. Daily is always Manhattan. */
  routeScope: 'manhattan' | 'all'
  /** Practice trains: 1 = direct, 2 or 3 with transfers. Daily is always 3. */
  lineCount: 1 | 2 | 3
}

export type Stats = {
  played: number
  wins: number
  currentStreak: number
  maxStreak: number
  guessDistribution: number[]
  lastDateKey: string | null
}
