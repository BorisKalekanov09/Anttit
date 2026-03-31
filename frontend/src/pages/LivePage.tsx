import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSimulation } from '../hooks/useSimulation'
import AgentNetwork from '../components/AgentNetwork'
import TimeSeriesChart from '../components/TimeSeriesChart'
import EventLog from '../components/EventLog'
import BreakdownPanel from '../components/BreakdownPanel'

const PANEL_STYLE = {
  glass: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
    fontWeight: 700,
    fontSize: 13,
    color: 'var(--text-secondary)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
    padding: '16px',
    overflow: 'hidden',
  },
}

export default function LivePage() {
  const { simId } = useParams<{ simId: string }>()
  const navigate = useNavigate()
  const { state, control, inject, snapshot } = useSimulation(simId)
  const [speed, setSpeed] = useState(0.4)

  const initData = state.initData
  const latestTick = state.latestTick
  const stateColors = initData?.state_colors ?? {}
  const states = initData?.states ?? []
  const totalAgents = latestTick?.total_agents ?? 0

  const handleSpeedChange = useCallback(async (v: number) => {
    setSpeed(v)
    await control('set_speed', v)
  }, [control])

  const handleSnapshot = async () => {
    const data = await snapshot()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sim-${simId}-tick${state.tick}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Snapshot exported!')
  }

  const [isStopping, setIsStopping] = useState(false)

  const handleStop = async () => {
    setIsStopping(true)
    await control('stop')
    toast('Simulation stopped — generating analysis...', { icon: '🔬' })
  }

  // Show analysis view after stop
  if (isStopping || state.analysis) {
    return <AnalysisView
      analysis={state.analysis}
      history={state.history}
      stateColors={stateColors}
      states={states}
      simId={simId ?? ''}
      onBack={() => navigate('/')}
    />
  }

  return (
    <div style={{ height: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(14,21,37,0.9)',
        backdropFilter: 'blur(20px)',
        flexShrink: 0,
      }}>
        <button className="btn-icon" onClick={() => navigate('/')} title="Back">←</button>
        <div>
          <span className="gradient-text" style={{ fontWeight: 800, fontSize: 16 }}>AgentSim</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
            {initData?.theme ?? 'Loading...'}
          </span>
        </div>

        {/* Live indicator */}
        {state.running && !state.paused && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              animation: 'glow-pulse 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>LIVE</span>
          </div>
        )}
        {state.paused && (
          <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>⏸ PAUSED</span>
        )}

        <div style={{ flex: 1 }} />

        {/* Tick counter */}
        <div className="stat-card" style={{ padding: '8px 16px', flexDirection: 'row', gap: 12 }}>
          <div>
            <div className="stat-value" style={{ fontSize: 20 }}>{state.tick}</div>
            <div className="stat-label">Tick</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <div className="stat-value" style={{ fontSize: 20 }}>{totalAgents}</div>
            <div className="stat-label">Agents</div>
          </div>
        </div>

        {/* State counts */}
        <div style={{ display: 'flex', gap: 6 }}>
          {states.map(s => {
            const count = latestTick?.state_counts[s] ?? 0
            const pct = totalAgents > 0 ? ((count / totalAgents) * 100).toFixed(0) : '0'
            return (
              <div key={s} className="stat-card" style={{ padding: '6px 12px', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: stateColors[s] ?? '#888' }} />
                  <span style={{ fontSize: 18, fontWeight: 800, color: stateColors[s] ?? '#888' }}>{pct}%</span>
                </div>
                <div className="stat-label">{s.replace(/_/g, ' ')}</div>
              </div>
            )
          })}
        </div>

        {/* Speed slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Speed</span>
          <input
            type="range" min={0.05} max={3} step={0.05}
            value={speed}
            onChange={e => handleSpeedChange(Number(e.target.value))}
            style={{ width: 80 }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {speed.toFixed(1)}s
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 6 }}>
          {state.paused ? (
            <button className="btn-secondary" onClick={() => control('resume')} style={{ fontSize: 12, padding: '6px 14px' }}>
              ▶ Resume
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => control('pause')} style={{ fontSize: 12, padding: '6px 14px' }}>
              ⏸ Pause
            </button>
          )}
          <button className="btn-secondary" onClick={handleSnapshot} style={{ fontSize: 12, padding: '6px 14px' }}>
            💾 Export
          </button>
          <button
            className="btn-secondary"
            onClick={handleStop}
            style={{ fontSize: 12, padding: '6px 14px', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}
          >
            ■ Stop & Analyze
          </button>
        </div>
      </header>

      {/* Inject events bar */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(8,11,20,0.6)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', marginRight: 4 }}>
          INJECT:
        </span>
        <button
          className="btn-secondary"
          onClick={() => { inject('rumour_burst'); toast('💥 Rumour burst injected!') }}
          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6 }}
        >
          💥 Rumour Burst
        </button>
        <button
          className="btn-secondary"
          onClick={() => { inject('reset_random'); toast('🔀 States randomized!') }}
          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6 }}
        >
          🔀 Randomize States
        </button>
      </div>

      {/* Main grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 12,
        padding: 12,
        minHeight: 0,
      }}>
        {/* Panel 1 — Network */}
        <div style={PANEL_STYLE.glass}>
          <div style={PANEL_STYLE.header}>
            <span>🕸 Agent Network</span>
            {initData && (
              <span style={{ fontWeight: 400, fontSize: 11 }}>
                {Object.keys(initData.positions).length > 300 ? 'Heatmap mode' : 'Graph mode'}
              </span>
            )}
          </div>
          <div style={{ flex: 1, padding: 12, minHeight: 0 }}>
            <AgentNetwork
              initData={initData}
              latestTick={latestTick}
              width={480}
              height={360}
            />
          </div>
        </div>

        {/* Panel 2 — Time Series */}
        <div style={PANEL_STYLE.glass}>
          <div style={PANEL_STYLE.header}>📈 Population Over Time</div>
          <div style={{ flex: 1, padding: '12px 16px', minHeight: 0 }}>
            <TimeSeriesChart
              history={state.history}
              stateColors={stateColors}
              states={states}
            />
          </div>
        </div>

        {/* Panel 3 — Event Log */}
        <div style={PANEL_STYLE.glass}>
          <div style={PANEL_STYLE.header}>
            <span>📋 Live Events</span>
            <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>
              {state.events.length} total
            </span>
          </div>
          <div style={{ ...PANEL_STYLE.body, overflowY: 'hidden' }}>
            <EventLog events={state.events} stateColors={stateColors} />
          </div>
        </div>

        {/* Panel 4 — Breakdown */}
        <div style={PANEL_STYLE.glass}>
          <div style={PANEL_STYLE.header}>👥 Personality Breakdown</div>
          <div style={{ ...PANEL_STYLE.body, overflowY: 'auto' }}>
            <BreakdownPanel
              latestTick={latestTick}
              stateColors={stateColors}
              states={states}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Analysis view ──────────────────────────────────────────────────────────

function AnalysisView({
  analysis, history, stateColors, states, simId, onBack
}: {
  analysis: string
  history: any[]
  stateColors: Record<string, string>
  states: string[]
  simId: string
  onBack: () => void
}) {
  const last = history[history.length - 1]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <header style={{
        padding: '20px 40px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16,
        background: 'rgba(14,21,37,0.8)', backdropFilter: 'blur(20px)',
      }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <div>
          <h1 className="gradient-text" style={{ fontSize: 24, fontWeight: 900 }}>Simulation Analysis</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>ID: {simId} · {history.length} ticks recorded</p>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          <div className="stat-card">
            <div className="stat-value gradient-text">{history.length}</div>
            <div className="stat-label">Total Ticks</div>
          </div>
          {states.map(s => (
            <div key={s} className="stat-card">
              <div className="stat-value" style={{ color: stateColors[s], fontSize: 22 }}>
                {last?.state_counts[s] ?? 0}
              </div>
              <div className="stat-label">{s.replace(/_/g, ' ')} (final)</div>
            </div>
          ))}
        </div>

        {/* Final time series */}
        <div className="glass" style={{ padding: 24 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Population History</h3>
          <div style={{ height: 280 }}>
            <TimeSeriesChart history={history} stateColors={stateColors} states={states} />
          </div>
        </div>

        {/* AI Analysis */}
        <div className="glass" style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>✦</div>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: 18 }}>Gemini Analysis</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI-generated summary of emergent behavior</p>
            </div>
          </div>
          {analysis ? (
            <div style={{
              lineHeight: 1.8, color: 'var(--text-secondary)', fontSize: 15,
              whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif',
            }}>
              {analysis}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              ⏳ Generating analysis... Gemini is reviewing your simulation data.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="btn-primary" onClick={onBack} style={{ padding: '14px 40px' }}>
            ← Start New Simulation
          </button>
        </div>
      </main>
    </div>
  )
}
