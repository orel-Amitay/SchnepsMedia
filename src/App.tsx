import { useEffect, useMemo, useRef, useState } from 'react'
import { Board } from './components/Board'
import { Keyboard } from './components/Keyboard'
import { Modal } from './components/Modal'
import { StationBanner } from './components/StationBanner'
import { LineBadge } from './components/LineBadge'
import { SponsorBar } from './components/SponsorBar'
import { IconReset, IconSettings, IconStats, IconTrophy } from './components/Icons'
import { isAdminPlayer } from './lib/admin'
import { trackEvent } from './lib/analytics'
import {
  completeGoogleRedirect,
  firebaseConfigured,
  signInAsGuest,
  signInWithGoogle,
  signInWithPassword,
  signOutPlayer,
  watchAuth,
  type Player,
} from './lib/auth'
import { buildShareText, isWin, scoreGuess } from './lib/feedback'
import {
  fetchLeaderboard,
  submitScore,
  type LeaderboardEntry,
} from './lib/leaderboard'
import { getDailyPuzzle, getPracticePuzzle, isPracticePuzzle } from './lib/puzzle'
import { loadSettings, saveSettings } from './lib/settings'
import { loadStats, recordFinish } from './lib/stats'
import { clearDay, loadDay, saveDay } from './lib/storage'
import { isValidTrip } from './lib/validate'
import type { LineId, Puzzle, Settings, Stats, TileStatus } from './lib/types'
import './App.css'

const MAX_GUESSES = 6

export default function App() {
  const [puzzle, setPuzzle] = useState<Puzzle>(() => getDailyPuzzle())
  const length = puzzle.solution.length
  const transfers = Math.max(0, length - 1)
  const isPractice = isPracticePuzzle(puzzle)
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
  const [authOpen, setAuthOpen] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [stats, setStats] = useState<Stats>(() => loadStats())
  const [player, setPlayer] = useState<Player | null>(null)
  const [guestName, setGuestName] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([])
  const [answerPeek, setAnswerPeek] = useState(false)
  const firstLoad = useRef(true)
  const practiceNonce = useRef(0)

  useEffect(() => watchAuth(setPlayer), [])

  useEffect(() => {
    trackEvent('page_view', null, { path: window.location.pathname })
  }, [])

  useEffect(() => {
    void completeGoogleRedirect()
      .then((p) => {
        if (!p) return
        setPlayer(p)
        trackEvent('sign_in', p, { method: 'google_redirect' })
        showToast(`Hi, ${p.displayName.split(' ')[0]}`)
      })
      .catch(() => {
        // ignore redirect noise on cold load
      })
  }, [])

  useEffect(() => {
    const saved = loadDay(puzzle.dateKey)
    if (saved) {
      setGuesses(saved.guesses)
      setStatuses(saved.guesses.map((g) => scoreGuess(g, puzzle.solution)))
      setGameStatus(saved.status)
      setAnswerPeek(false)
      setRevealRow(null)
      setCurrent([])
      if (saved.status !== 'playing' && firstLoad.current) setStatsOpen(true)
    } else {
      setGuesses([])
      setStatuses([])
      setCurrent([])
      setGameStatus('playing')
      setAnswerPeek(false)
      setRevealRow(null)
      if (firstLoad.current) setHelpOpen(true)
    }
    firstLoad.current = false
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

  useEffect(() => {
    if (!boardOpen) return
    trackEvent('leaderboard_open', player)
    const dailyKey = getDailyPuzzle().dateKey
    void fetchLeaderboard(isPractice ? dailyKey : puzzle.dateKey).then(setLeaders)
  }, [boardOpen, puzzle.dateKey, gameStatus, player, isPractice])

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

  function showToast(msg: string, ms = 2200) {
    setToast(msg)
    window.setTimeout(() => setToast(null), Math.max(ms, msg.length > 40 ? 4500 : 2200))
  }

  function pulseShake() {
    setShake(true)
    window.setTimeout(() => setShake(false), 450)
  }

  async function publishResult(next: 'won' | 'lost', guessCount: number, who: Player | null) {
    if (!who || isPractice) return
    try {
      await submitScore({
        player: who,
        dateKey: puzzle.dateKey,
        won: next === 'won',
        guesses: guessCount,
      })
    } catch {
      // offline / rules
    }
  }

  function finishGame(next: 'won' | 'lost', guessCount: number) {
    setGameStatus(next)
    setStats(recordFinish({ dateKey: puzzle.dateKey, won: next === 'won', guesses: guessCount }))
    trackEvent(next === 'won' ? 'game_win' : 'game_lose', player, {
      guesses: guessCount,
      practice: isPractice,
      dateKey: puzzle.dateKey,
    })
    void publishResult(next, guessCount, player)
    setStatsOpen(true)
  }

  function switchPuzzle(next: Puzzle, toastMsg: string) {
    setHydrated(false)
    setPuzzle(next)
    setGuesses([])
    setStatuses([])
    setCurrent([])
    setGameStatus('playing')
    setAnswerPeek(false)
    setRevealRow(null)
    setStatsOpen(false)
    showToast(toastMsg)
  }

  function newRoute() {
    practiceNonce.current += 1
    trackEvent('new_route', player)
    switchPuzzle(getPracticePuzzle(Date.now() + practiceNonce.current), 'New route')
  }

  function todaysRoute() {
    trackEvent('today_route', player)
    switchPuzzle(getDailyPuzzle(), "Today's route")
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
      if (helpOpen || statsOpen || settingsOpen || authOpen || boardOpen) return
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

  /** Peek at the solution without ending / locking the game. */
  function revealAnswer() {
    setAnswerPeek(true)
    trackEvent('peek_answer', player, { dateKey: puzzle.dateKey })
    showToast('Answer shown — you can keep playing')
  }

  function resetGame() {
    clearDay(puzzle.dateKey)
    setGuesses([])
    setStatuses([])
    setCurrent([])
    setGameStatus('playing')
    setAnswerPeek(false)
    setRevealRow(null)
    trackEvent('reset', player, { dateKey: puzzle.dateKey })
    showToast('Board reset')
  }

  async function handleGoogle() {
    setAuthBusy(true)
    try {
      const p = await signInWithGoogle()
      setPlayer(p)
      setAuthOpen(false)
      trackEvent('sign_in', p, { method: 'google' })
      showToast(`Hi, ${p.displayName.split(' ')[0]}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'REDIRECTING') {
        showToast('Redirecting to Google…')
        return
      }
      if (msg === 'GOOGLE_NOT_CONFIGURED') {
        showToast('Add Firebase keys for Google')
      } else {
        showToast(msg || 'Google sign-in failed')
      }
    } finally {
      setAuthBusy(false)
    }
  }

  function handleGuest() {
    const p = signInAsGuest(guestName)
    setPlayer(p)
    setAuthOpen(false)
    trackEvent('sign_in', p, { method: 'guest' })
    showToast(`Playing as ${p.displayName}`)
  }

  async function handlePassword() {
    setAuthBusy(true)
    try {
      const p = await signInWithPassword(password, guestName || 'Schneps Admin')
      setPlayer(p)
      setAuthOpen(false)
      setPassword('')
      trackEvent('sign_in', p, { method: 'password' })
      showToast(`Hi, ${p.displayName.split(' ')[0]}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'WRONG_PASSWORD') showToast('Wrong password')
      else showToast(msg || 'Password sign-in failed')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    trackEvent('sign_out', player)
    await signOutPlayer()
    setPlayer(null)
    showToast('Signed out')
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
      trackEvent('share', player, { dateKey: puzzle.dateKey })
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        showToast('Copied results')
        trackEvent('share', player, { dateKey: puzzle.dateKey })
      } catch {
        showToast('Could not share')
      }
    }
  }

  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0
  const maxDist = Math.max(1, ...stats.guessDistribution)

  return (
    <div className="app">
      <SponsorBar />

      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className={`auth-chip${player ? ' auth-chip--signed-in' : ''}`}
            onClick={() => (player ? setSettingsOpen(true) : setAuthOpen(true))}
            aria-label={player ? 'Account' : 'Sign in'}
          >
            {player?.photoURL ? (
              <img className="auth-avatar" src={player.photoURL} alt="" />
            ) : player ? (
              <span className="auth-avatar auth-avatar--placeholder">
                {player.displayName[0]?.toUpperCase()}
              </span>
            ) : (
              <span className="google-g" aria-hidden="true">
                G
              </span>
            )}
            <span className="auth-chip-text">
              {player ? player.displayName.split(' ')[0] : 'Sign in'}
            </span>
          </button>
        </div>
        <h1 className="brand-title">Transfer</h1>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" onClick={() => setBoardOpen(true)} aria-label="Leaderboard">
            <IconTrophy />
          </button>
          <button type="button" className="icon-btn" onClick={() => setStatsOpen(true)} aria-label="Statistics">
            <IconStats />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={resetGame}
            aria-label="Reset board"
            title="Reset board"
          >
            <IconReset />
          </button>
          <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <IconSettings />
          </button>
        </div>
      </header>

      <main className="main">
        <StationBanner
          originId={puzzle.originId}
          destinationId={puzzle.destinationId}
          transfers={transfers}
          streak={stats.currentStreak}
          isPractice={isPractice}
          onOpenStats={() => setStatsOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onNewRoute={newRoute}
          onTodayRoute={todaysRoute}
        />

        {(debug || answerPeek) && (
          <div className="debug-answer" role="status">
            <span className="debug-label">{answerPeek ? 'Answer' : 'Debug answer'}</span>
            <div className="result-solution">
              {puzzle.solution.map((line, i) => (
                <LineBadge key={`dbg-${line}-${i}`} line={line} size="md" />
              ))}
            </div>
            {answerPeek && gameStatus === 'playing' && (
              <button type="button" className="peek-hide" onClick={() => setAnswerPeek(false)}>
                Hide
              </button>
            )}
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
        <p>Guess today’s TRANSFER in 6 tries.</p>
        <p>
          Each guess must be a valid subway trip involving {length} train
          {length === 1 ? '' : 's'} using available transfers between them.
        </p>
        <div className="sponsor-note">
          <img src="/schneps-media.png" alt="" className="sponsor-note-logo" />
          <p>
            This daily NYC subway puzzle is presented by{' '}
            <a href="https://www.schnepsmedia.com/" target="_blank" rel="noopener noreferrer">
              Schneps Media
            </a>
            .
          </p>
        </div>
        <h3 className="help-sub">Examples</h3>
        <ul className="help-examples">
          <li>
            <span className="swatch swatch--correct" />
            <span>
              <strong>Green</strong> — train is in the correct spot.
            </span>
          </li>
          <li>
            <span className="swatch swatch--shared" />
            <span>
              <strong>Blue</strong> — shared routing in that spot.
            </span>
          </li>
          <li>
            <span className="swatch swatch--present" />
            <span>
              <strong>Yellow</strong> — in the trip, wrong spot.
            </span>
          </li>
          <li>
            <span className="swatch swatch--absent" />
            <span>
              <strong>Gray</strong> — not in the trip.
            </span>
          </li>
        </ul>
        <p className="help-note">A Schneps Media daily puzzle — not affiliated with the MTA or other subway games.</p>
      </Modal>

      <Modal open={authOpen} title="Sign in" onClose={() => setAuthOpen(false)}>
        <p>Sign in with the shared password to save your name on this device and open admin tools.</p>
        <label className="guest-label" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          className="guest-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handlePassword()
          }}
          autoComplete="current-password"
        />
        <label className="guest-label" htmlFor="guest-name">
          Display name (optional)
        </label>
        <input
          id="guest-name"
          className="guest-input"
          placeholder="Display name"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          maxLength={24}
        />
        <button type="button" className="share-btn" onClick={() => void handlePassword()} disabled={authBusy}>
          {authBusy ? 'Signing in…' : 'Sign in with password'}
        </button>
        <p className="help-note">
          By signing in you agree to our{' '}
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          .
        </p>
        <div className="guest-box">
          <button type="button" className="google-btn" onClick={handleGoogle} disabled={authBusy}>
            <span className="google-g" aria-hidden="true">
              G
            </span>
            {authBusy ? 'Connecting…' : 'Try Google instead'}
          </button>
          {!firebaseConfigured && (
            <p className="help-note">Google is optional and may be unavailable on this host.</p>
          )}
          <button type="button" className="btn-ghost" onClick={handleGuest}>
            Continue as guest
          </button>
        </div>
      </Modal>

      <Modal open={boardOpen} title="Leaderboard" onClose={() => setBoardOpen(false)}>
        <p className="board-date">Today · {getDailyPuzzle().dateKey}</p>
        {!player && (
          <button type="button" className="google-btn" onClick={() => { setBoardOpen(false); setAuthOpen(true) }}>
            Sign in to compete
          </button>
        )}
        {leaders.length === 0 ? (
          <p className="help-note">No scores yet today. Finish a puzzle to appear here.</p>
        ) : (
          <ol className="leaderboard">
            {leaders.map((e, i) => (
              <li key={e.uid} className={player?.uid === e.uid ? 'leaderboard-me' : undefined}>
                <span className="lb-rank">{i + 1}</span>
                {e.photoURL ? (
                  <img className="lb-avatar" src={e.photoURL} alt="" />
                ) : (
                  <span className="lb-avatar lb-avatar--ph">{e.displayName[0]?.toUpperCase()}</span>
                )}
                <span className="lb-name">{e.displayName}</span>
                <span className="lb-score">
                  {e.won ? `${e.guesses}/6` : 'X'}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="help-note">Presented by Schneps Media · lower guesses rank higher.</p>
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
            <div className="stat-label">Streak</div>
          </div>
          <div className="stat">
            <div className="stat-num">{stats.maxStreak}</div>
            <div className="stat-label">Best</div>
          </div>
        </div>
        <p className="help-note stats-streak-note">
          Streak counts consecutive wins. Lose once and it resets. Use New route to keep going.
        </p>
        {gameStatus !== 'playing' && (
          <button type="button" className="btn-primary stats-next-route" onClick={() => { setStatsOpen(false); newRoute() }}>
            Next route
          </button>
        )}
        <h3 className="help-sub">Guess Distribution</h3>
        <div className="dist">
          {stats.guessDistribution.map((n, i) => (
            <div className="dist-row" key={i}>
              <span className="dist-label">{i + 1}</span>
              <div className="dist-bar-wrap">
                <div className="dist-bar" style={{ width: `${Math.max(8, (n / maxDist) * 100)}%` }}>
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
            <div className="stats-actions">
              <button type="button" className="share-btn" onClick={share}>
                Share
              </button>
              <button
                type="button"
                className="reveal-btn reveal-btn--modal"
                onClick={() => {
                  resetGame()
                  setStatsOpen(false)
                }}
              >
                Play again
              </button>
              <button type="button" className="reveal-btn reveal-btn--modal" onClick={() => setBoardOpen(true)}>
                Leaderboard
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        {player ? (
          <div className="account-row">
            <div>
              <strong>{player.displayName}</strong>
              <div className="help-note" style={{ margin: 0 }}>
                {player.provider === 'google'
                  ? 'Signed in with Google'
                  : player.provider === 'password'
                    ? 'Signed in with password'
                    : 'Guest player'}
              </div>
            </div>
            <button type="button" className="btn-ghost btn-compact" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="google-btn google-btn--compact"
            onClick={() => {
              setSettingsOpen(false)
              setAuthOpen(true)
            }}
          >
            Sign in
          </button>
        )}
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
        <div className="settings-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              revealAnswer()
              setSettingsOpen(false)
            }}
          >
            Show answer
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              resetGame()
              setSettingsOpen(false)
            }}
          >
            Reset board
          </button>
          {isAdminPlayer(player) && (
            <a className="btn-ghost settings-admin-link" href="/admin">
              Admin metrics →
            </a>
          )}
        </div>
      </Modal>
    </div>
  )
}
