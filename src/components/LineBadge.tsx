import { getRoute } from '../lib/graph'
import type { LineId } from '../lib/types'

type Props = {
  line: LineId | null
  size?: 'sm' | 'md' | 'lg'
  dimmed?: boolean
}

export function LineBadge({ line, size = 'md', dimmed }: Props) {
  const route = line ? getRoute(line) : undefined
  const label = route?.name ?? line ?? ''
  const bg = route?.color ?? '#3a3f47'
  const fg = route?.textColor ?? '#ffffff'

  return (
    <span
      className={`line-badge line-badge--${size}${dimmed ? ' line-badge--dimmed' : ''}`}
      style={{ backgroundColor: bg, color: fg }}
      aria-label={line ? `Line ${label}` : 'Empty'}
    >
      {label || '·'}
    </span>
  )
}
