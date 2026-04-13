import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import TimeSeriesChart from '../components/TimeSeriesChart'
import type { TickMessage } from '../types/simulation'

interface RunData {
  simId: string
  history: TickMessage[]
  states: string[]
  stateColors: Record<string, string>
  stats: { totalTicks: number; agentCount: number; dominantState: string }
  advancedMetrics?: { polarizationIndex: number; echoChamberScore: number } | null
}

async function fetchRun(simId: string): Promise<RunData | null> {
  try {
    const res = await fetch(`/api/simulations/${simId}/analysis`)
    if (!res.ok) return null
    const data = await res.json()
    return { simId, ...data }
  } catch {
    return null
  }
}

export default function ComparisonPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [availableIds, setAvailableIds] = useState<string[]>([])
  const [runAId, setRunAId] = useState(searchParams.get('a') ?? '')
  const [runBId, setRunBId] = useState(searchParams.get('b') ?? '')
  const [runA, setRunA] = useState<RunData | null>(null)
  const [runB, setRunB] = useState<RunData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analyses')
      .then(r => r.json())
      .then(d => setAvailableIds(d.ids ?? []))
      .catch(() => {})
  }, [])

  const compare = async () => {
    if (!runAId || !runBId) { setError('Select two runs to compare'); return }
    if (runAId === runBId) { setError('Select two different runs'); return }
    setLoading(true)
    setError(null)
    const [a, b] = await Promise.all([fetchRun(runAId), fetchRun(runBId)])
    if (!a || !b) { setError('Could not load one or both runs. Make sure they were stopped with "Stop & Analyze".'); setLoading(false); return }
    setRunA(a)
    setRunB(b)
    setLoading(false)
  }

  const allStates = runA && runB
    ? [...new Set([...runA.states, ...runB.states])]
    : []

  const finalCountsA = runA?.history.at(-1)?.state_counts ?? {}
  const finalCountsB = runB?.history.at(-1)?.state_counts ?? {}

  return (
    <AppShell title="Run Comparison" showBackButton>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Selector */}
        <div className="glass" style={{ padding: '24px', borderRadius: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>Select Runs to Compare</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                Run A
              </label>
              <select
                value={runAId}
                onChange={e => setRunAId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, minWidth: 200 }}
              >
                <option value="">— select —</option>
                {availableIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                Run B
              </label>
              <select
                value={runBId}
                onChange={e => setRunBId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, minWidth: 200 }}
              >
                <option value="">— select —</option>
                {availableIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <button
              className="btn-primary"
              onClick={compare}
              disabled={loading || !runAId || !runBId}
              style={{ padding: '10px 28px' }}
            >
              {loading ? 'Loading…' : '⚖ Compare'}
            </button>
            <button className="btn-secondary" onClick={() => navigate('/')} style={{ padding: '10px 20px' }}>
              ← Home
            </button>
          </div>
          {error && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--error, #ef4444)' }}>{error}</div>}
          {availableIds.length === 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              No saved analyses found yet. Stop a simulation with "Stop & Analyze" to save a run.
            </div>
          )}
        </div>

        {runA && runB && (
          <>
            {/* Side-by-side charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[runA, runB].map((run, i) => (
                <div key={run.simId} className="glass" style={{ padding: '24px', borderRadius: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                      background: i === 0 ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)',
                      color: i === 0 ? 'var(--accent)' : '#10b981',
                    }}>
                      Run {i === 0 ? 'A' : 'B'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{run.simId}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {run.stats.totalTicks} ticks · {run.stats.agentCount} agents
                    </span>
                  </div>
                  <div style={{ height: 220 }}>
                    <TimeSeriesChart history={run.history} stateColors={run.stateColors} states={run.states} />
                  </div>
                </div>
              ))}
            </div>

            {/* Diff table */}
            <div className="glass" style={{ padding: '24px', borderRadius: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>Final State Distribution</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['State', 'Run A', 'Run B', 'Difference'].map(h => (
                        <th key={h} style={{ padding: '8px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allStates.map(state => {
                      const color = runA.stateColors[state] ?? runB.stateColors[state] ?? '#888'
                      const aCount = finalCountsA[state] ?? 0
                      const bCount = finalCountsB[state] ?? 0
                      const aTot = Object.values(finalCountsA).reduce((s, n) => s + n, 0) || 1
                      const bTot = Object.values(finalCountsB).reduce((s, n) => s + n, 0) || 1
                      const aPct = ((aCount / aTot) * 100).toFixed(1)
                      const bPct = ((bCount / bTot) * 100).toFixed(1)
                      const diff = ((aCount / aTot) - (bCount / bTot)) * 100
                      return (
                        <tr key={state} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{state.replace(/_/g, ' ')}</span>
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--accent)' }}>{aCount} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({aPct}%)</span></td>
                          <td style={{ padding: '10px 16px', color: '#10b981' }}>{bCount} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({bPct}%)</span></td>
                          <td style={{ padding: '10px 16px', color: diff > 0 ? 'var(--accent)' : diff < 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 700 }}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Metrics comparison */}
            {(runA.advancedMetrics || runB.advancedMetrics) && (
              <div className="glass" style={{ padding: '24px', borderRadius: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>Metrics Comparison</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  {(['polarizationIndex', 'echoChamberScore'] as const).map(metric => {
                    const labelMap = { polarizationIndex: 'Polarization', echoChamberScore: 'Echo Chamber' }
                    const vA = runA.advancedMetrics?.[metric]
                    const vB = runB.advancedMetrics?.[metric]
                    return (
                      <div key={metric} style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '16px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{labelMap[metric]}</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 2 }}>Run A</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{vA !== undefined && vA !== null ? `${(vA * 100).toFixed(0)}%` : '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#10b981', marginBottom: 2 }}>Run B</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{vB !== undefined && vB !== null ? `${(vB * 100).toFixed(0)}%` : '—'}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
