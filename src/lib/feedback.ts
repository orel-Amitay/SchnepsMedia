import { sharesRouting } from './routeGroups'
import type { LineId, TileStatus } from './types'

/**
 * Feedback inspired by subwaydle.com:
 * Green  — exact line in exact position
 * Blue   — guessed line shares routing with the correct line in that spot
 * Yellow — line appears in the solution elsewhere
 * Gray   — not in the solution
 */
export function scoreGuess(guess: LineId[], solution: LineId[]): TileStatus[] {
  const len = solution.length
  const statuses: TileStatus[] = Array.from({ length: len }, () => 'absent')
  const remaining = new Map<LineId, number>()

  for (let i = 0; i < len; i++) {
    const s = solution[i]!
    remaining.set(s, (remaining.get(s) ?? 0) + 1)
  }

  for (let i = 0; i < len; i++) {
    const g = guess[i]
    if (g && g === solution[i]) {
      statuses[i] = 'correct'
      remaining.set(g, (remaining.get(g) ?? 1) - 1)
    }
  }

  for (let i = 0; i < len; i++) {
    if (statuses[i] === 'correct') continue
    const g = guess[i]
    if (!g) {
      statuses[i] = 'absent'
      continue
    }
    if (sharesRouting(g, solution[i]!)) {
      statuses[i] = 'shared'
      continue
    }
    const left = remaining.get(g) ?? 0
    if (left > 0) {
      statuses[i] = 'present'
      remaining.set(g, left - 1)
    } else {
      statuses[i] = 'absent'
    }
  }

  return statuses
}

export function isWin(statuses: TileStatus[]): boolean {
  return statuses.length > 0 && statuses.every((s) => s === 'correct')
}

const emoji: Record<TileStatus, string> = {
  correct: '🟩',
  shared: '🟦',
  present: '🟨',
  absent: '⬛',
  empty: '⬜',
  pending: '⬜',
}

export function buildShareText(opts: {
  dateKey: string
  guesses: LineId[][]
  solution: LineId[]
  won: boolean
  maxGuesses: number
}): string {
  const { dateKey, guesses, solution, won, maxGuesses } = opts
  const score = won ? String(guesses.length) : 'X'
  const rows = guesses
    .map((g) => scoreGuess(g, solution).map((s) => emoji[s]).join(''))
    .join('\n')

  return `Subwaydle NYC ${dateKey} ${score}/${maxGuesses}\n${rows}`
}
