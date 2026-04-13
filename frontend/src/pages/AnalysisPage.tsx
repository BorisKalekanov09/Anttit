import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import TimeSeriesChart from '../components/TimeSeriesChart'
import type { TickMessage, AdvancedMetrics } from '../types/simulation'

interface AnalysisReport {
  summary: string
  timeline: string
  personalities: Record<string, string>
  realWorldParallel: string
  recommendations: string[]
}

export default function AnalysisPage() {
  const { simId } = useParams<{ simId: string }>()
  const navigate = useNavigate()
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [history, setHistory] = useState<TickMessage[]>([])
  const [states, setStates] = useState<string[]>([])
  const [stateColors, setStateColors] = useState<Record<string, string>>({})
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedMetrics | null>(null)

  useEffect(() => {
    if (!simId) {
      navigate('/')
      return
    }

    const applyData = (data: any) => {
      setReport(data.report || null)
      setStats(data.stats || null)
      setHistory(data.history || [])
      setStates(data.states || [])
      setStateColors(data.stateColors || {})
      setAdvancedMetrics(data.advancedMetrics || null)
      setLoading(false)
    }

    // Try backend first (survives page refresh), then fall back to sessionStorage
    fetch(`/api/simulations/${simId}/analysis`)
      .then(res => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then(applyData)
      .catch(() => {
        const stored = sessionStorage.getItem(`sim-analysis-${simId}`)
        if (!stored) {
          navigate('/')
          return
        }
        try {
          applyData(JSON.parse(stored))
        } catch {
          navigate('/')
        }
      })
  }, [simId, navigate])

  if (loading || !report || !stats) {
    return (
      <AppShell title="Loading Analysis..." showBackButton>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Retrieving simulation analysis...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Simulation Analysis" showBackButton>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Header card */}
        <div className="glass" style={{ padding: '32px', borderRadius: 16 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8 }}>Simulation Complete</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Simulation {simId?.slice(0, 8)}... finished after {stats.totalTicks} ticks with {stats.agentCount} agents
          </p>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="stat-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Total Ticks</div>
            <div style={{ fontSize: 32, fontWeight: 800, background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {stats.totalTicks}
            </div>
          </div>
          <div className="stat-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Agents</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent2)' }}>
              {stats.agentCount}
            </div>
          </div>
          <div className="stat-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Dominant State</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--success)' }}>
              {stats.dominantState?.replace(/_/g, ' ') || '—'}
            </div>
          </div>
          <div className="stat-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Peak Velocity Tick</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent2)' }}>
              {stats.peakVelocityTick ?? '—'}
            </div>
          </div>
        </div>

        {/* Time Series Chart */}
        {history.length > 0 && (
          <div className="glass" style={{ padding: '32px', borderRadius: 16, minHeight: 400 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>Population Over Time</h2>
            <div style={{ height: 300 }}>
              <TimeSeriesChart
                history={history}
                stateColors={stateColors}
                states={states}
              />
            </div>
          </div>
        )}

        {/* Executive Summary */}
        <div className="glass" style={{ padding: '32px', borderRadius: 16 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>Executive Summary</h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {report.summary}
          </p>
        </div>

        {/* Timeline */}
        <div className="glass" style={{ padding: '32px', borderRadius: 16 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>Timeline</h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {report.timeline}
          </p>
        </div>

        {/* Personality Analysis */}
        {Object.keys(report.personalities).length > 0 && (
          <div className="glass" style={{ padding: '32px', borderRadius: 16 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>Personality Analysis</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(report.personalities).map(([personality, analysis]) => (
                <div key={personality} style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', marginBottom: 8 }}>
                    {personality}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {analysis}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-World Parallel */}
        <div className="glass" style={{ padding: '32px', borderRadius: 16 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>Real-World Parallel</h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {report.realWorldParallel}
          </p>
        </div>

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div className="glass" style={{ padding: '32px', borderRadius: 16 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>Recommendations</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {report.recommendations.map((rec, idx) => (
                <li 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    gap: 12, 
                    fontSize: 14,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    listStyle: 'none',
                  }}
                >
                  <span style={{ color: 'var(--accent)', fontWeight: 800, flexShrink: 0, minWidth: 24 }}>
                    {idx + 1}.
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Advanced Metrics */}
        {advancedMetrics && (
          <div className="glass" style={{ padding: '32px', borderRadius: 16 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>Analysis Metrics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <MetricGauge
                label="Polarization Index"
                value={advancedMetrics.polarizationIndex}
                description="How split the population is across opposing states (0 = unified, 1 = fully polarized)"
                color={advancedMetrics.polarizationIndex > 0.6 ? 'var(--error)' : advancedMetrics.polarizationIndex > 0.35 ? 'var(--warning, #f59e0b)' : 'var(--success)'}
              />
              <MetricGauge
                label="Echo Chamber Score"
                value={advancedMetrics.echoChamberScore}
                description="Fraction of social edges connecting agents in the same state (1 = fully siloed)"
                color={advancedMetrics.echoChamberScore > 0.7 ? 'var(--error)' : advancedMetrics.echoChamberScore > 0.45 ? 'var(--warning, #f59e0b)' : 'var(--success)'}
              />
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '20px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.06em' }}>Spread Speed</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent2)', marginBottom: 6 }}>
                  {advancedMetrics.spreadSpeed !== null ? `Tick ${advancedMetrics.spreadSpeed}` : 'Not reached'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Tick when seed state first reached 50% of agents
                </div>
              </div>
            </div>

            {/* Group comparison */}
            {advancedMetrics.groupMetrics && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Experimental Groups</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <GroupMetricCard label="Control Group" counts={advancedMetrics.groupMetrics.controlStateCounts} color="var(--accent)" />
                  <GroupMetricCard label="Treatment Group" counts={advancedMetrics.groupMetrics.treatmentStateCounts} color="var(--error)" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, paddingBottom: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const json = JSON.stringify({ report, stats, advancedMetrics }, null, 2)
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `analysis-${simId}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="btn-secondary"
            style={{ padding: '12px 28px' }}
          >
            📥 Export JSON
          </button>
          <button
            onClick={() => {
              if (history.length === 0) return
              const headers = ['tick', ...states]
              const rows = history.map(h => [h.tick, ...states.map(s => h.state_counts[s] ?? 0)])
              const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `analysis-${simId}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="btn-secondary"
            style={{ padding: '12px 28px' }}
          >
            📊 Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="btn-secondary"
            style={{ padding: '12px 28px' }}
          >
            🖨 Print / PDF
          </button>
          <button
            onClick={() => {
              const text = `Analysis Report: ${report.summary}\n\n${report.timeline}`
              navigator.clipboard.writeText(text)
            }}
            className="btn-secondary"
            style={{ padding: '12px 28px' }}
          >
            📋 Copy Report
          </button>
          <button
            onClick={() => navigate(`/compare?a=${simId}`)}
            className="btn-secondary"
            style={{ padding: '12px 28px' }}
          >
            ⚖ Compare Runs
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
            style={{ padding: '12px 40px' }}
          >
            ← New Simulation
          </button>
        </div>
      </div>
    </AppShell>
  )
}

function MetricGauge({ label, value, description, color }: { label: string; value: number; description: string; color: string }) {
  const pct = Math.round(value * 100)
  return (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '20px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 8 }}>{pct}%</div>
      <div style={{ background: 'var(--bg-card)', borderRadius: 4, height: 6, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{description}</div>
    </div>
  )
}

function GroupMetricCard({ label, counts, color }: { label: string; counts: Record<string, number>; color: string }) {
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  return (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '16px', border: `1px solid ${color}44` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {total === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No agents assigned</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(counts).map(([state, count]) => (
            <div key={state} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{state}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{count} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({Math.round(count / total * 100)}%)</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
