import { getPlayableLines, getRoute } from '../lib/graph'
import type { LineId, TileStatus } from '../lib/types'

type Props = {
  onPick: (line: LineId) => void
  onDelete: () => void
  onEnter: () => void
  keyHints: Record<string, TileStatus>
  disabled?: boolean
}

export function Keyboard({ onPick, onDelete, onEnter, keyHints, disabled }: Props) {
  const lines = getPlayableLines()
  const rows: LineId[][] = [
    lines.filter((l) => ['1', '2', '3', '4', '5', '6', '6X', '7', '7X'].includes(l)),
    lines.filter((l) => ['A', 'C', 'E', 'B', 'D', 'F', 'M'].includes(l)),
    lines.filter((l) => ['G', 'J', 'Z', 'L', 'N', 'Q', 'R', 'W'].includes(l)),
    lines.filter(
      (l) =>
        !['1', '2', '3', '4', '5', '6', '6X', '7', '7X', 'A', 'C', 'E', 'B', 'D', 'F', 'M', 'G', 'J', 'Z', 'L', 'N', 'Q', 'R', 'W'].includes(
          l,
        ),
    ),
  ].filter((r) => r.length > 0)

  return (
    <div className="keyboard" aria-label="Line keyboard">
      {rows.map((row, i) => (
        <div className="keyboard-row" key={i}>
          {row.map((line) => {
            const route = getRoute(line)
            const hint = keyHints[line]
            return (
              <button
                key={line}
                type="button"
                className={`key key-line${hint ? ` key--${hint}` : ''}`}
                style={!hint ? { backgroundColor: route?.color, color: route?.textColor } : undefined}
                onClick={() => onPick(line)}
                disabled={disabled}
                aria-label={`Line ${route?.name ?? line}`}
              >
                {route?.name ?? line}
              </button>
            )
          })}
        </div>
      ))}
      <div className="keyboard-row keyboard-row--actions">
        <button type="button" className="key key-action" onClick={onEnter} disabled={disabled}>
          Enter
        </button>
        <button type="button" className="key key-action" onClick={onDelete} disabled={disabled}>
          Delete
        </button>
      </div>
    </div>
  )
}
