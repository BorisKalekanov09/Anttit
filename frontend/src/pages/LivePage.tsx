import { useState, useCallback, useRef, useEffect } from 'react'
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [whatIfInput, setWhatIfInput] = useState('')
  const [whatIfLoading, setWhatIfLoading] = useState(false)
  const [showWhatIfConfirm, setShowWhatIfConfirm] = useState(false)
  const [pendingWhatIf, setPendingWhatIf] = useState<{ eventType: string; payload: object; preview: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [networkSize, setNetworkSize] = useState({ width: 480, height: 360 })

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

  const handleWhatIfPreview = async () => {
    if (!whatIfInput.trim()) {
      toast.error('Please describe a what-if scenario')
      return
    }
    
    setWhatIfLoading(true)
    try {
      const res = await fetch(`/api/simulations/${simId}/whatif`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: whatIfInput }),
      })
      
      if (!res.ok) throw new Error('What-if analysis failed')
      
      const data = await res.json()
      
      if (!data.eventType || !data.payload || !data.preview) {
        throw new Error('Invalid what-if response format')
      }
      
      toast.success('📊 What-if scenario analyzed. Review & confirm injection?')
      setPendingWhatIf({
        eventType: data.eventType,
        payload: data.payload,
        preview: data.preview,
      })
      setShowWhatIfConfirm(true)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'What-if analysis failed'
      toast.error(errMsg)
    } finally {
      setWhatIfLoading(false)
    }
  }

  const handleWhatIfConfirm = async () => {
    if (!pendingWhatIf) return
    
    try {
      await inject(pendingWhatIf.eventType, pendingWhatIf.payload)
      toast.success('✅ What-if scenario injected!')
      setWhatIfInput('')
      setPendingWhatIf(null)
      setShowWhatIfConfirm(false)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Injection failed'
      toast.error(errMsg)
    }
  }

  const handleStop = async () => {
    try {
      await control('stop')
      
      await new Promise(r => setTimeout(r, 1000))
      
      // Compute peak velocity: largest absolute change in total agents between consecutive ticks
      let peakVelocityTick = 0
      let peakVelocity = 0
      if (state.history.length > 1) {
        for (let i = 1; i < state.history.length; i++) {
          const prev = state.history[i - 1].total_agents
          const curr = state.history[i].total_agents
          const delta = Math.abs(curr - prev)
          if (delta > peakVelocity) {
            peakVelocity = delta
            peakVelocityTick = state.history[i].tick
          }
        }
      }
      
      const analysisKey = `sim-analysis-${simId}`
      const analysisData = {
        report: state.analysisReport || {
          summary: 'Analysis generation in progress...',
          timeline: `Simulation completed at tick ${state.tick} with ${state.latestTick?.total_agents ?? 0} agents`,
          personalities: {},
          realWorldParallel: 'See full analysis for details',
          recommendations: [],
        },
        stats: {
          totalTicks: state.tick,
          agentCount: state.latestTick?.total_agents ?? 0,
          dominantState: Object.entries(state.latestTick?.state_counts ?? {}).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'unknown',
          peakVelocityTick,
        },
        history: state.history,
        states: states,
        stateColors: stateColors,
      }
      
      sessionStorage.setItem(analysisKey, JSON.stringify(analysisData))
      toast.success('Analysis saved! Redirecting...', { icon: '🔬' })
      
      setTimeout(() => {
        navigate(`/analysis/${simId}`)
      }, 1000)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Stop failed'
      toast.error(errMsg)
    }
  }

  // Responsive sizing for AgentNetwork
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const newWidth = Math.max(300, rect.width - 32)
        const newHeight = Math.max(200, rect.height - 80)
        setNetworkSize({ width: newWidth, height: newHeight })
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    handleResize() // Initial size

    return () => resizeObserver.disconnect()
  }, [])

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
          <button
            className="btn-secondary"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ fontSize: 12, padding: '6px 14px' }}
            title="Toggle sidebar"
          >
            {sidebarOpen ? '◀' : '▶'}
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

      {/* Main grid with sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Main content area */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 12,
          padding: 12,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Panel 1 — Network */}
          <div style={PANEL_STYLE.glass} ref={containerRef}>
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
                width={networkSize.width}
                height={networkSize.height}
                events={state.events}
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

        {/* Sidebar — What-If Mode & Stats */}
        {sidebarOpen && (
          <div style={{
            width: 320,
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)' }}>WHAT-IF MODE</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* What-If Input */}
              <div>
                <label className="label" style={{ marginBottom: 8 }}>Scenario</label>
                <textarea
                  className="input"
                  value={whatIfInput}
                  onChange={e => setWhatIfInput(e.target.value)}
                  placeholder="Describe a hypothetical event or intervention..."
                  rows={4}
                  style={{ resize: 'vertical', lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}
                />
              </div>

              <button
                className="btn-primary"
                onClick={handleWhatIfPreview}
                disabled={whatIfLoading || !whatIfInput.trim()}
                style={{ width: '100%', padding: '10px 16px', fontSize: 13 }}
              >
                {whatIfLoading ? '⏳ Analyzing...' : '🔮 Preview Impact'}
              </button>

              {/* Current Stats */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Live Stats
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Current Tick:</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{state.tick}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Agents:</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{totalAgents}</span>
                  </div>
                  {states.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>State Distribution:</div>
                      {states.map(s => {
                        const count = latestTick?.state_counts[s] ?? 0
                        const pct = totalAgents > 0 ? ((count / totalAgents) * 100).toFixed(0) : '0'
                        return (
                          <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: stateColors[s] ?? '#888', flexShrink: 0 }} />
                              {s.replace(/_/g, ' ')}
                            </span>
                            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* What-If Confirmation Dialog */}
      {showWhatIfConfirm && pendingWhatIf && (
        <div 
          className="modal-overlay" 
          onClick={e => { if (e.target === e.currentTarget) setShowWhatIfConfirm(false) }}
        >
          <div className="modal">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--gradient-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>🔮</div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>What-If Impact Preview</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review the predicted scenario effects</p>
              </div>
            </div>
            <div style={{ 
              background: 'var(--bg-surface)', 
              padding: '16px',
              borderRadius: 12,
              marginBottom: 24,
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {pendingWhatIf.preview}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowWhatIfConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleWhatIfConfirm}
              >
                ✓ Inject & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
