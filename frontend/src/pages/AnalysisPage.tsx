import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import TimeSeriesChart from '../components/TimeSeriesChart'
import type { TickMessage } from '../types/simulation'

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

  useEffect(() => {
    if (!simId) {
      navigate('/')
      return
    }

    const key = `sim-analysis-${simId}`
    const stored = sessionStorage.getItem(key)

    if (!stored) {
      navigate('/')
      return
    }

    try {
      const data = JSON.parse(stored)
      setReport(data.report || null)
      setStats(data.stats || null)
      setHistory(data.history || [])
      setStates(data.states || [])
      setStateColors(data.stateColors || {})
      setLoading(false)
    } catch (err) {
      console.error('Failed to parse analysis:', err)
      navigate('/')
    }
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

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, paddingBottom: 32, justifyContent: 'center' }}>
          <button
            onClick={() => {
              const json = JSON.stringify({ report, stats }, null, 2)
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
              const text = `Analysis Report: ${report.summary}\n\n${report.timeline}`
              navigator.clipboard.writeText(text)
            }}
            className="btn-secondary"
            style={{ padding: '12px 28px' }}
          >
            📋 Copy Report
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
