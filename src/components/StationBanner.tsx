import { ROUTE_SCOPE_LABEL, type RouteScope } from '../lib/boroughs'
import { getStation } from '../lib/graph'
import { LINE_COUNT_OPTIONS, lineCountLabel, type LineCount } from '../lib/puzzle'
import type { StationId } from '../lib/types'
import { IconFlame, IconHelp, IconShuffle } from './Icons'

type Props = {
  originId: StationId
  destinationId: StationId
  transfers: number
  streak: number
  isPractice: boolean
  routeScope: RouteScope
  lineCount: LineCount
  onRouteScopeChange: (scope: RouteScope) => void
  onLineCountChange: (count: LineCount) => void
  onOpenStats: () => void
  onOpenHelp: () => void
  onNewRoute: () => void
  onTodayRoute: () => void
}

function transferText(transfers: number) {
  if (transfers === 0) return 'Direct'
  if (transfers === 1) return '1 transfer'
  return `${transfers} transfers`
}

export function StationBanner({
  originId,
  destinationId,
  transfers,
  streak,
  isPractice,
  routeScope,
  lineCount,
  onRouteScopeChange,
  onLineCountChange,
  onOpenStats,
  onOpenHelp,
  onNewRoute,
  onTodayRoute,
}: Props) {
  const origin = getStation(originId)
  const destination = getStation(destinationId)
  const areaLabel = isPractice ? ROUTE_SCOPE_LABEL[routeScope] : 'Manhattan'

  return (
    <div className="trip-prompt" aria-label={isPractice ? 'Practice trip' : "Today's trip"}>
      <div className="trip-toolbar">
        <div className="trip-toolbar-start">
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
          <button
            type="button"
            className="route-chip route-chip--icon"
            onClick={onOpenHelp}
            aria-label="How to play"
            title="How to play"
          >
            <IconHelp size={15} />
            Help
          </button>
        </div>
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

      <div className="route-controls">
        <div className="scope-toggle" role="group" aria-label="Route area">
          <button
            type="button"
            className={`scope-chip${routeScope === 'manhattan' ? ' scope-chip--active' : ''}`}
            onClick={() => onRouteScopeChange('manhattan')}
            aria-pressed={routeScope === 'manhattan'}
          >
            Manhattan
          </button>
          <button
            type="button"
            className={`scope-chip${routeScope === 'all' ? ' scope-chip--active' : ''}`}
            onClick={() => onRouteScopeChange('all')}
            aria-pressed={routeScope === 'all'}
            title="Practice routes across all boroughs"
          >
            All NYC
          </button>
        </div>

        <div className="scope-toggle" role="group" aria-label="Number of trains">
          {LINE_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`scope-chip${lineCount === n ? ' scope-chip--active' : ''}`}
              onClick={() => onLineCountChange(n)}
              aria-pressed={lineCount === n}
              title={n === 1 ? 'One train, no transfer' : `${n} trains`}
            >
              {lineCountLabel(n)}
            </button>
          ))}
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
          {transferText(transfers)}
          {' · '}
          {areaLabel}
          {isPractice ? ' · practice' : ' · daily'}
        </span>
        <span className="trip-transfers-rule" aria-hidden="true" />
      </p>
    </div>
  )
}
