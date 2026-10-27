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

export type TileStatus = 'correct' | 'present' | 'absent' | 'empty' | 'pending'

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
