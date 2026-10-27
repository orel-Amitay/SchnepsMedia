import type { LineId, TileStatus } from '../lib/types'
import { LineBadge } from './LineBadge'

type Props = {
  solutionLength: number
  maxGuesses: number
  guesses: LineId[][]
  statuses: TileStatus[][]
  current: LineId[]
  shake: boolean
  revealRow: number | null
}

function tileClass(status: TileStatus, revealing: boolean): string {
  const base = `tile tile--${status}`
  if (revealing) return `${base} tile--reveal`
  return base
}

export function Board({
  solutionLength,
  maxGuesses,
  guesses,
  statuses,
  current,
  shake,
  revealRow,
}: Props) {
  const rows: Array<{ lines: (LineId | null)[]; statuses: TileStatus[]; isCurrent: boolean; index: number }> = []

  for (let i = 0; i < maxGuesses; i++) {
    if (i < guesses.length) {
      rows.push({
        lines: guesses[i]!,
        statuses: statuses[i]!,
        isCurrent: false,
        index: i,
      })
    } else if (i === guesses.length) {
      const lines: (LineId | null)[] = Array.from({ length: solutionLength }, (_, j) => current[j] ?? null)
      rows.push({
        lines,
        statuses: Array.from({ length: solutionLength }, () => 'pending'),
        isCurrent: true,
        index: i,
      })
    } else {
      rows.push({
        lines: Array.from({ length: solutionLength }, () => null),
        statuses: Array.from({ length: solutionLength }, () => 'empty'),
        isCurrent: false,
        index: i,
      })
    }
  }

  return (
    <div className="board" role="grid" aria-label="Guesses">
      {rows.map((row) => (
        <div
          key={row.index}
          className={`board-row${row.isCurrent && shake ? ' board-row--shake' : ''}`}
          role="row"
        >
          {row.lines.map((line, j) => {
            const status = row.statuses[j]!
            const revealing = revealRow === row.index
            return (
              <div
                key={j}
                className={tileClass(status, revealing)}
                style={revealing ? { animationDelay: `${j * 180}ms` } : undefined}
                role="gridcell"
              >
                {line ? <LineBadge line={line} size="lg" /> : <span className="tile-empty" />}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
