import { useEffect, useState } from 'react'
import { isAdminPlayer } from '../lib/admin'
import {
  signInWithPassword,
  signOutPlayer,
  watchAuth,
  type Player,
} from '../lib/auth'
import { loadMetricsSnapshot, type MetricsSnapshot } from '../lib/metrics'
import './AdminMetrics.css'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  )
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString()
}

export function AdminMetrics() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [snap, setSnap] = useState<MetricsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const admin = isAdminPlayer(player)

  useEffect(() => watchAuth(setPlayer), [])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setSnap(await loadMetricsSnapshot())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!admin) return
    void refresh()
    const id = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(id)
  }, [admin])

  function handlePassword() {
    setError(null)
    try {
      const p = signInWithPassword(password)
      setPlayer(p)
      setPassword('')
    } catch {
      setError('Wrong password')
    }
  }

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div>
          <p className="admin-kicker">Schneps Media · Admin</p>
          <h1>Transfer metrics</h1>
        </div>
        <div className="admin-header-actions">
          <a className="admin-link" href="/">
            ← Game
          </a>
          {player && (
            <button type="button" className="admin-btn" onClick={() => void signOutPlayer()}>
              Sign out
            </button>
          )}
        </div>
      </header>

      {!player && (
        <section className="admin-card">
          <h2>Admin sign-in</h2>
          <p>Enter the shared admin password to view metrics.</p>
          <input
            className="admin-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePassword()
            }}
            autoComplete="current-password"
          />
          <button type="button" className="admin-btn admin-btn--primary" onClick={handlePassword}>
            Sign in
          </button>
          {error && <p className="admin-error">{error}</p>}
        </section>
      )}

      {player && !admin && (
        <section className="admin-card">
          <h2>Access denied</h2>
          <p>
            Signed in as <strong>{player.email ?? player.displayName}</strong>, but this account is not an
            admin.
          </p>
          <button type="button" className="admin-btn" onClick={() => void signOutPlayer()}>
            Switch account
          </button>
        </section>
      )}

      {admin && (
        <>
          <div className="admin-toolbar">
            <span className="admin-muted">
              {snap ? `Updated ${formatTime(snap.generatedAt)} · day ${snap.todayKey}` : 'Loading…'}
            </span>
            <button type="button" className="admin-btn" onClick={() => void refresh()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {error && <p className="admin-error">{error}</p>}

          {snap && (
            <>
              <h2 className="admin-section-title">Today</h2>
              <div className="admin-grid">
                <Stat label="Page views" value={snap.today.pageViews} />
                <Stat label="Sign-ins" value={snap.today.signIns} />
                <Stat label="Games" value={snap.today.games} />
                <Stat label="Win rate" value={`${snap.today.winRate}%`} />
                <Stat label="Wins" value={snap.today.wins} />
                <Stat label="Losses" value={snap.today.losses} />
                <Stat label="New routes" value={snap.today.newRoutes} />
                <Stat label="Unique players" value={snap.today.uniquePlayers} />
              </div>

              <h2 className="admin-section-title">All time (recent buffer)</h2>
              <div className="admin-grid">
                <Stat label="Events" value={snap.totals.events} />
                <Stat label="Page views" value={snap.totals.pageViews} />
                <Stat label="Sign-ins" value={snap.totals.signIns} />
                <Stat label="Games" value={snap.totals.games} />
                <Stat label="Win rate" value={`${snap.totals.winRate}%`} />
                <Stat label="Shares" value={snap.totals.shares} />
                <Stat label="New routes" value={snap.totals.newRoutes} />
                <Stat label="Unique players" value={snap.totals.uniquePlayers} />
              </div>

              <div className="admin-columns">
                <section className="admin-card">
                  <h3>Guess distribution (wins)</h3>
                  <div className="admin-bars">
                    {snap.guessDistribution.map((n, i) => {
                      const max = Math.max(1, ...snap.guessDistribution)
                      return (
                        <div className="admin-bar-row" key={i}>
                          <span>{i + 1}</span>
                          <div className="admin-bar-track">
                            <div className="admin-bar-fill" style={{ width: `${(n / max) * 100}%` }}>
                              {n}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                <section className="admin-card">
                  <h3>Top players</h3>
                  {snap.topPlayers.length === 0 ? (
                    <p className="admin-muted">No finished games yet.</p>
                  ) : (
                    <ol className="admin-list">
                      {snap.topPlayers.map((p) => (
                        <li key={p.uid}>
                          <span>{p.name}</span>
                          <span>
                            {p.wins}W / {p.games}G
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>

              <section className="admin-card">
                <h3>Today’s leaderboard</h3>
                {snap.leaderboardToday.length === 0 ? (
                  <p className="admin-muted">No cloud scores today yet.</p>
                ) : (
                  <ol className="admin-list">
                    {snap.leaderboardToday.map((e, i) => (
                      <li key={`${e.uid}-${e.dateKey}`}>
                        <span>
                          {i + 1}. {e.displayName}
                        </span>
                        <span>{e.won ? `${e.guesses}/6 · ${e.score}` : `X · ${e.score}`}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="admin-card">
                <h3>Recent events</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>User</th>
                        <th>Meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.recent.map((e, i) => (
                        <tr key={`${e.createdAt}-${e.type}-${i}`}>
                          <td>{formatTime(e.createdAt)}</td>
                          <td>{e.type}</td>
                          <td>{e.displayName ?? e.email ?? e.provider}</td>
                          <td>{Object.keys(e.meta).length ? JSON.stringify(e.meta) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}
