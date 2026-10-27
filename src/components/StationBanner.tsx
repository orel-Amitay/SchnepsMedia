import { getStation } from '../lib/graph'
import type { StationId } from '../lib/types'
import { IconFlame, IconShuffle } from './Icons'

type Props = {
  originId: StationId
  destinationId: StationId
  transfers: number
  streak: number
  isPractice: boolean
  onOpenStats: () => void
  onNewRoute: () => void
  onTodayRoute: () => void
}

export function StationBanner({
  originId,
  destinationId,
  transfers,
  streak,
  isPractice,
  onOpenStats,
  onNewRoute,
  onTodayRoute,
}: Props) {
  const origin = getStation(originId)
  const destination = getStation(destinationId)
  const transferLabel =
    transfers === 1 ? '1 transfer' : `${transfers} transfers`

  return (
    <div className="trip-prompt" aria-label={isPractice ? 'Practice trip' : "Today's trip"}>
      <div className="trip-toolbar">
        <button
          type="button"
          className={`streak-chip${streak > 0 ? ' streak-chip--hot' : ''}`}
          onClick={onOpenStats}
          aria-label={`Win streak ${streak}`}
          title="Win streak"
        >
          <IconFlame size={15} />
          <span className="streak-chip-num">{streak}</span>
          <span className="streak-chip-label">streak</span>
        </button>
        <div className="trip-toolbar-actions">
          {isPractice && (
            <button type="button" className="route-chip" onClick={onTodayRoute}>
              Today
            </button>
          )}
          <button
            type="button"
            className="route-chip route-chip--primary"
            onClick={onNewRoute}
            aria-label="New route"
            title="New route"
          >
            <IconShuffle size={14} />
            New route
          </button>
        </div>
      </div>

      <div className="trip-route">
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
      <p className="trip-transfers">
        <span className="trip-transfers-rule" aria-hidden="true" />
        <span>
          {transferLabel}
          {isPractice ? ' · practice' : ''}
        </span>
        <span className="trip-transfers-rule" aria-hidden="true" />
      </p>
    </div>
  )
}
