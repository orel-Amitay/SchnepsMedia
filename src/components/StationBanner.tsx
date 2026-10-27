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
    <p className="trip-prompt">
      Travel from <strong>{origin?.name ?? originId}</strong> to{' '}
      <strong>{destination?.name ?? destinationId}</strong> using {transferLabel}.
    </p>
  )
}
