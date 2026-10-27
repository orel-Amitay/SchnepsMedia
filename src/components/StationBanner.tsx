import { getStation } from '../lib/graph'
import type { StationId } from '../lib/types'

type Props = {
  originId: StationId
  destinationId: StationId
  dateKey: string
}

export function StationBanner({ originId, destinationId, dateKey }: Props) {
  const origin = getStation(originId)
  const destination = getStation(destinationId)

  return (
    <section className="trip" aria-label="Today's trip">
      <p className="trip-date">{dateKey}</p>
      <div className="trip-route">
        <div className="trip-station">
          <span className="trip-label">From</span>
          <h2 className="trip-name">{origin?.name ?? originId}</h2>
        </div>
        <div className="trip-arrow" aria-hidden="true">
          <span className="trip-rail" />
          <span className="trip-chevron">→</span>
        </div>
        <div className="trip-station trip-station--dest">
          <span className="trip-label">To</span>
          <h2 className="trip-name">{destination?.name ?? destinationId}</h2>
        </div>
      </div>
      <p className="trip-hint">Guess the sequence of subway lines for a minimum-transfer ride.</p>
    </section>
  )
}
