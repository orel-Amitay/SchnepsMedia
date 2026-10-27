import { getRoute } from '../lib/graph'
import type { LineId, TileStatus } from '../lib/types'

type Props = {
  line: LineId | null
  size?: 'sm' | 'md' | 'lg'
  status?: TileStatus
}

export function LineBadge({ line, size = 'md', status }: Props) {
  const route = line ? getRoute(line) : undefined
  const label = route?.name ?? line ?? ''
  const bg = route?.color ?? '#3a3f47'
  const fg = route?.textColor ?? '#ffffff'

  return (
    <span
      className={`line-badge line-badge--${size}${status ? ` line-badge--status-${status}` : ''}`}
      style={{ backgroundColor: bg, color: fg }}
      aria-label={line ? `Line ${label}` : 'Empty'}
    >
      {label || '·'}
    </span>
  )
}
