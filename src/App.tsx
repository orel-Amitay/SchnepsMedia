import { useEffect, useMemo, useState } from 'react'
import { Board } from './components/Board'
import { Keyboard } from './components/Keyboard'
import { Modal } from './components/Modal'
import { StationBanner } from './components/StationBanner'
import { LineBadge } from './components/LineBadge'
import { buildShareText, isWin, scoreGuess } from './lib/feedback'
import { getDailyPuzzle } from './lib/puzzle'
import { loadDay, saveDay } from './lib/storage'
import type { LineId, TileStatus } from './lib/types'
import './App.css'

const MAX_GUESSES = 6

export default function App() {
  const puzzle = useMemo(() => getDailyPuzzle(), [])
  const length = puzzle.solution.length
  const debug = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).has('debug')
  }, [])

  const [guesses, setGuesses] = useState<LineId[][]>([])
  const [statuses, setStatuses] = useState<TileStatus[][]>([])
  const [current, setCurrent] = useState<LineId[]>([])
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing')
  const [shake, setShake] = useState(false)
  const [revealRow, setRevealRow] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = loadDay(puzzle.dateKey)
    if (saved) {
      setGuesses(saved.guesses)
      setStatuses(saved.guesses.map((g) => scoreGuess(g, puzzle.solution)))
      setGameStatus(saved.status)
      if (saved.status !== 'playing') setResultOpen(true)
    } else {
      setHelpOpen(true)
    }
    setHydrated(true)
  }, [puzzle])

  useEffect(() => {
    if (!hydrated) return
    saveDay({ dateKey: puzzle.dateKey, guesses, status: gameStatus })
  }, [guesses, gameStatus, puzzle.dateKey, hydrated])

  const keyHints = useMemo(() => {
    const hints: Record<string, TileStatus> = {}
    const rank: Record<TileStatus, number> = {
      correct: 3,
      present: 2,
      absent: 1,
      empty: 0,
      pending: 0,
    }
    statuses.forEach((row, ri) => {
      row.forEach((st, ci) => {
        const line = guesses[ri]?.[ci]
        if (!line) return
        if (!hints[line] || rank[st] > rank[hints[line]!]) hints[line] = st
      })
    })
    return hints
  }, [guesses, statuses])

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  function pulseShake() {
    setShake(true)
    window.setTimeout(() => setShake(false), 450)
  }

  function onPick(line: LineId) {
    if (gameStatus !== 'playing') return
    if (current.length >= length) {
      pulseShake()
      showToast('Press Enter')
      return
    }
    setCurrent((c) => [...c, line])
  }

  function onDelete() {
    if (gameStatus !== 'playing') return
    setCurrent((c) => c.slice(0, -1))
  }

  function onEnter() {
    if (gameStatus !== 'playing') return
    if (current.length < length) {
      pulseShake()
      showToast('Fill every slot')
      return
    }

    const result = scoreGuess(current, puzzle.solution)
    const nextGuesses = [...guesses, current]
    const nextStatuses = [...statuses, result]
    const rowIndex = guesses.length

    setGuesses(nextGuesses)
    setStatuses(nextStatuses)
    setCurrent([])
    setRevealRow(rowIndex)

    window.setTimeout(() => {
      setRevealRow(null)
      if (isWin(result)) {
        setGameStatus('won')
        setResultOpen(true)
      } else if (nextGuesses.length >= MAX_GUESSES) {
        setGameStatus('lost')
        setResultOpen(true)
      }
    }, length * 180 + 350)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (helpOpen || resultOpen) return
      if (e.key === 'Enter') {
        e.preventDefault()
        onEnter()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        onDelete()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // Intentionally rebind when game inputs change
  })

  async function share() {
    const text = buildShareText({
      dateKey: puzzle.dateKey,
      guesses,
      solution: puzzle.solution,
      won: gameStatus === 'won',
      maxGuesses: MAX_GUESSES,
    })
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        showToast('Copied results')
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        showToast('Copied results')
      } catch {
        showToast('Could not share')
      }
    }
  }

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => setHelpOpen(true)} aria-label="How to play">
          ?
        </button>
        <div className="brand">
          <p className="brand-kicker">Daily NYC</p>
          <h1 className="brand-title">Subwaydle</h1>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setResultOpen(true)}
          aria-label="Results"
          disabled={gameStatus === 'playing' && guesses.length === 0}
        >
          ≡
        </button>
      </header>

      <main className="main">
        <StationBanner
          originId={puzzle.originId}
          destinationId={puzzle.destinationId}
          dateKey={puzzle.dateKey}
        />

        {debug && (
          <div className="debug-answer" role="status">
            <span className="debug-label">Debug answer</span>
            <div className="result-solution">
              {puzzle.solution.map((line, i) => (
                <LineBadge key={`dbg-${line}-${i}`} line={line} size="md" />
              ))}
            </div>
            <p className="debug-hint">Visible because URL has ?debug — remove it for normal play.</p>
          </div>
        )}

        <Board
          solutionLength={length}
          maxGuesses={MAX_GUESSES}
          guesses={guesses}
          statuses={statuses}
          current={current}
          shake={shake}
          revealRow={revealRow}
        />

        <Keyboard
          onPick={onPick}
          onDelete={onDelete}
          onEnter={onEnter}
          keyHints={keyHints}
          disabled={gameStatus !== 'playing'}
        />
      </main>

      {toast && <div className="toast">{toast}</div>}

      <Modal open={helpOpen} title="How to play" onClose={() => setHelpOpen(false)}>
        <p>
          Each day you get one trip between two NYC subway stations. Guess the{' '}
          <strong>sequence of lines</strong> for a minimum-transfer route.
        </p>
        <ul className="help-list">
          <li>
            <span className="swatch swatch--correct" /> Correct line in the correct position
          </li>
          <li>
            <span className="swatch swatch--present" /> Line is in the route, wrong position
          </li>
          <li>
            <span className="swatch swatch--absent" /> Line is not in the route
          </li>
        </ul>
        <p className="help-note">
          Topology is derived from the MTA GTFS subway feed. Inspired by the Subwaydle concept —
          original implementation, not affiliated with subwaydle.com or the MTA.
        </p>
      </Modal>

      <Modal
        open={resultOpen}
        title={gameStatus === 'won' ? 'You made it' : gameStatus === 'lost' ? 'End of the line' : 'Progress'}
        onClose={() => setResultOpen(false)}
      >
        <p className="result-summary">
          {gameStatus === 'won'
            ? `Solved in ${guesses.length}/${MAX_GUESSES}.`
            : gameStatus === 'lost'
              ? 'Out of guesses. The correct lines were:'
              : `Guesses used: ${guesses.length}/${MAX_GUESSES}.`}
        </p>
        {(gameStatus === 'lost' || gameStatus === 'won') && (
          <div className="result-solution" aria-label="Solution">
            {puzzle.solution.map((line, i) => (
              <LineBadge key={`${line}-${i}`} line={line} size="md" />
            ))}
          </div>
        )}
        {gameStatus !== 'playing' && (
          <button type="button" className="share-btn" onClick={share}>
            Share results
          </button>
        )}
      </Modal>
    </div>
  )
}
