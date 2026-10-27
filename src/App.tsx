import { useEffect, useMemo, useState } from 'react'
import { Board } from './components/Board'
import { Keyboard } from './components/Keyboard'
import { Modal } from './components/Modal'
import { StationBanner } from './components/StationBanner'
import { LineBadge } from './components/LineBadge'
import { buildShareText, isWin, scoreGuess } from './lib/feedback'
import { getDailyPuzzle } from './lib/puzzle'
import { loadSettings, saveSettings } from './lib/settings'
import { loadStats, recordFinish } from './lib/stats'
import { loadDay, saveDay } from './lib/storage'
import { isValidTrip } from './lib/validate'
import type { LineId, Settings, Stats, TileStatus } from './lib/types'
import './App.css'

const MAX_GUESSES = 6

export default function App() {
  const puzzle = useMemo(() => getDailyPuzzle(), [])
  const length = puzzle.solution.length
  const transfers = Math.max(0, length - 1)
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
  const [statsOpen, setStatsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [stats, setStats] = useState<Stats>(() => loadStats())

  useEffect(() => {
    const saved = loadDay(puzzle.dateKey)
    if (saved) {
      setGuesses(saved.guesses)
      setStatuses(saved.guesses.map((g) => scoreGuess(g, puzzle.solution)))
      setGameStatus(saved.status)
      if (saved.status !== 'playing') setStatsOpen(true)
    } else {
      setHelpOpen(true)
    }
    setHydrated(true)
  }, [puzzle])

  useEffect(() => {
    if (!hydrated) return
    saveDay({ dateKey: puzzle.dateKey, guesses, status: gameStatus })
  }, [guesses, gameStatus, puzzle.dateKey, hydrated])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.darkMode ? 'dark' : 'light'
    saveSettings(settings)
  }, [settings])

  const keyHints = useMemo(() => {
    const hints: Record<string, TileStatus> = {}
    const rank: Record<TileStatus, number> = {
      correct: 4,
      shared: 3,
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

  function finishGame(next: 'won' | 'lost', guessCount: number) {
    setGameStatus(next)
    setStats(recordFinish({ dateKey: puzzle.dateKey, won: next === 'won', guesses: guessCount }))
    setStatsOpen(true)
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

    if (!isValidTrip(puzzle.originId, puzzle.destinationId, current)) {
      pulseShake()
      showToast('Not a valid trip')
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
      if (isWin(result)) finishGame('won', nextGuesses.length)
      else if (nextGuesses.length >= MAX_GUESSES) finishGame('lost', nextGuesses.length)
    }, length * 180 + 350)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (helpOpen || statsOpen || settingsOpen) return
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
  })

  function revealAnswer() {
    if (gameStatus === 'playing') {
      setStats(recordFinish({ dateKey: puzzle.dateKey, won: false, guesses: guesses.length }))
      setGameStatus('lost')
      setCurrent([])
    }
  }

  async function share() {
    const text = buildShareText({
      dateKey: puzzle.dateKey,
      guesses,
      solution: puzzle.solution,
      won: gameStatus === 'won',
      maxGuesses: MAX_GUESSES,
    })
    try {
      if (navigator.share) await navigator.share({ text })
      else {
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

  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0
  const maxDist = Math.max(1, ...stats.guessDistribution)

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-spacer" aria-hidden="true" />
        <h1 className="brand-title">Subwaydle</h1>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" onClick={() => setHelpOpen(true)} aria-label="How to play">
            ?
          </button>
          <button type="button" className="icon-btn" onClick={() => setStatsOpen(true)} aria-label="Statistics">
            ▮▮
          </button>
          <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            ⚙
          </button>
        </div>
      </header>

      <main className="main">
        <StationBanner
          originId={puzzle.originId}
          destinationId={puzzle.destinationId}
          transfers={transfers}
        />

        {debug && (
          <div className="debug-answer" role="status">
            <span className="debug-label">Debug answer</span>
            <div className="result-solution">
              {puzzle.solution.map((line, i) => (
                <LineBadge key={`dbg-${line}-${i}`} line={line} size="md" />
              ))}
            </div>
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
          showBadges={settings.showStatusBadges}
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

      <Modal open={helpOpen} title="How to Play" onClose={() => setHelpOpen(false)}>
        <p>Guess the SUBWAYDLE in 6 tries.</p>
        <p>
          Each guess must be a valid subway trip involving {length} train
          {length === 1 ? '' : 's'} using available transfers between them.
        </p>
        <p>You need to guess a specific set of trains that can make the trip.</p>
        <h3 className="help-sub">Examples</h3>
        <ul className="help-examples">
          <li>
            <span className="swatch swatch--correct" />
            <span>
              <strong>Green</strong> — train is in the correct spot of the trip.
            </span>
          </li>
          <li>
            <span className="swatch swatch--shared" />
            <span>
              <strong>Blue</strong> — another train that shares the same routing is in that spot.
            </span>
          </li>
          <li>
            <span className="swatch swatch--present" />
            <span>
              <strong>Yellow</strong> — train is part of the trip, but in the wrong spot.
            </span>
          </li>
          <li>
            <span className="swatch swatch--absent" />
            <span>
              <strong>Gray</strong> — train is not part of the trip in any spot.
            </span>
          </li>
        </ul>
        <p className="help-note">
          Multiple routings may be possible, but the goal is the puzzle of the day (minimum-transfer
          routing on midday GTFS topology). Original game inspired by subwaydle.com — not affiliated.
        </p>
      </Modal>

      <Modal open={statsOpen} title="Statistics" onClose={() => setStatsOpen(false)}>
        <div className="stats-row">
          <div className="stat">
            <div className="stat-num">{stats.played}</div>
            <div className="stat-label">Played</div>
          </div>
          <div className="stat">
            <div className="stat-num">{winPct}</div>
            <div className="stat-label">Win %</div>
          </div>
          <div className="stat">
            <div className="stat-num">{stats.currentStreak}</div>
            <div className="stat-label">Current Streak</div>
          </div>
          <div className="stat">
            <div className="stat-num">{stats.maxStreak}</div>
            <div className="stat-label">Max Streak</div>
          </div>
        </div>
        <h3 className="help-sub">Guess Distribution</h3>
        <div className="dist">
          {stats.guessDistribution.map((n, i) => (
            <div className="dist-row" key={i}>
              <span className="dist-label">{i + 1}</span>
              <div className="dist-bar-wrap">
                <div
                  className="dist-bar"
                  style={{ width: `${Math.max(8, (n / maxDist) * 100)}%` }}
                >
                  {n}
                </div>
              </div>
            </div>
          ))}
        </div>
        {gameStatus !== 'playing' && (
          <>
            <p className="result-summary">
              {gameStatus === 'won'
                ? `Solved in ${guesses.length}/${MAX_GUESSES}.`
                : 'The correct lines were:'}
            </p>
            <div className="result-solution" aria-label="Solution">
              {puzzle.solution.map((line, i) => (
                <LineBadge key={`sol-${line}-${i}`} line={line} size="md" />
              ))}
            </div>
            <button type="button" className="share-btn" onClick={share}>
              Share
            </button>
          </>
        )}
      </Modal>

      <Modal open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <label className="setting-row">
          <span>Show answer status badges</span>
          <input
            type="checkbox"
            checked={settings.showStatusBadges}
            onChange={(e) => setSettings((s) => ({ ...s, showStatusBadges: e.target.checked }))}
          />
        </label>
        <label className="setting-row">
          <span>Dark mode</span>
          <input
            type="checkbox"
            checked={settings.darkMode}
            onChange={(e) => setSettings((s) => ({ ...s, darkMode: e.target.checked }))}
          />
        </label>
        {gameStatus === 'playing' && (
          <button
            type="button"
            className="reveal-btn reveal-btn--modal"
            onClick={() => {
              revealAnswer()
              setSettingsOpen(false)
              setStatsOpen(true)
            }}
          >
            Show answer
          </button>
        )}
      </Modal>
    </div>
  )
}
