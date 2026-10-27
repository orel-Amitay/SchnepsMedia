import { getStation } from '../lib/graph'
import type { StationId } from '../lib/types'

type Props = {
  originId: StationId
  destinationId: StationId
  transfers: number
}

export function StationBanner({ originId, destinationId, transfers }: Props) {
  const origin = getStation(originId)
  const destination = getStation(destinationId)
  const transferLabel =
    transfers === 1 ? '1 transfer' : `${transfers} transfers`

  return (
    <div className="trip-prompt" aria-label="Today's trip">
      <div className="trip-route-card">
        <div className="trip-stop">
          <span className="trip-stop-label">From</span>
          <span className="trip-stop-name">{origin?.name ?? originId}</span>
        </div>
        <span className="trip-arrow" aria-hidden="true">
          →
        </span>
        <div className="trip-stop trip-stop--to">
          <span className="trip-stop-label">To</span>
          <span className="trip-stop-name">{destination?.name ?? destinationId}</span>
        </div>
      </div>
      <p className="trip-transfers">using {transferLabel}</p>
    </div>
  )
}
