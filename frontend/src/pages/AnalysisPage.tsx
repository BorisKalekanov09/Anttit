import React, { useEffect, useState } from 'react'
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
    if (!simId) { navigate('/'); return }

    const applyData = (data: any) => {
      setReport(data.report || null)
      setStats(data.stats || null)
      setHistory(data.history || [])
      setStates(data.states || [])
      setStateColors(data.stateColors || {})
      setAdvancedMetrics(data.advancedMetrics || null)
      setLoading(false)
    }

    fetch(`/api/simulations/${simId}/analysis`)
      .then(res => { if (!res.ok) throw new Error('not found'); return res.json() })
      .then(applyData)
      .catch(() => {
        const stored = sessionStorage.getItem(`sim-analysis-${simId}`)
        if (!stored) { navigate('/'); return }
        try { applyData(JSON.parse(stored)) } catch { navigate('/') }
      })
  }, [simId, navigate])

  if (loading || !report || !stats) {
    return (
      <AppShell title="Loading Analysis..." showBackButton>
        <div style={{ padding: '48px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            animation: 'liveBlip 1.2s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Retrieving simulation analysis...
          </span>
        </div>
        <style>{`@keyframes liveBlip { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      </AppShell>
    )
  }

  return (
    <AppShell title="Analysis" showBackButton>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 32px 64px', display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* ── Hero header ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'end',
          padding: '32px 0 28px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 32,
          gap: 24,
        }}>
          <div>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <div style={{ width: 16, height: 1, background: 'var(--accent)' }} />
              Simulation Complete
            </div>
            <h1 style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 38,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              color: 'var(--text-primary)',
              marginBottom: 10,
            }}>
              Analysis Report
            </h1>
            <p style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 11,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
            }}>
              Run <span style={{ color: 'var(--text-secondary)' }}>{simId?.slice(0, 8)}...</span>
              {' · '}{stats.totalTicks} ticks{' · '}{stats.agentCount} agents
            </p>
          </div>
          {/* Export actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                const json = JSON.stringify({ report, stats, advancedMetrics }, null, 2)
                const blob = new Blob([json], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = `analysis-${simId}.json`; a.click()
                URL.revokeObjectURL(url)
              }}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: 10 }}
            >
              ↓ JSON
            </button>
            <button
              onClick={() => {
                if (!history.length) return
                const headers = ['tick', ...states]
                const rows = history.map(h => [h.tick, ...states.map(s => h.state_counts[s] ?? 0)])
                const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = `analysis-${simId}.csv`; a.click()
                URL.revokeObjectURL(url)
              }}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: 10 }}
            >
              ↓ CSV
            </button>
            <button
              onClick={() => window.print()}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: 10 }}
            >
              Print
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(`${report.summary}\n\n${report.timeline}`)}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: 10 }}
            >
              Copy
            </button>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 32,
        }}>
          {[
            { label: 'Total Ticks',        value: stats.totalTicks,                                  color: 'var(--accent)'  },
            { label: 'Agents',             value: stats.agentCount,                                  color: 'var(--accent2)' },
            { label: 'Dominant State',     value: stats.dominantState?.replace(/_/g, ' ') || '—',   color: 'var(--success)' },
            { label: 'Peak Velocity Tick', value: stats.peakVelocityTick ?? '—',                     color: 'var(--accent3)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card slide-up">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Time series chart ── */}
        {history.length > 0 && (
          <Section label="Population Over Time">
            <div style={{ height: 280 }}>
              <TimeSeriesChart history={history} stateColors={stateColors} states={states} />
            </div>
          </Section>
        )}

        {/* ── Executive Summary ── */}
        <Section label="Executive Summary">
          <p style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 15,
            color: 'var(--text-secondary)',
            lineHeight: 1.85,
          }}>
            {report.summary}
          </p>
        </Section>

        {/* ── Timeline ── */}
        <Section label="Timeline">
          <p style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.9,
            whiteSpace: 'pre-wrap',
            letterSpacing: '0.01em',
          }}>
            {report.timeline}
          </p>
        </Section>

        {/* ── Personality Analysis ── */}
        {Object.keys(report.personalities).length > 0 && (
          <Section label={`Personality Analysis (${Object.keys(report.personalities).length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(report.personalities).map(([personality, analysis]) => (
                <div key={personality} style={{
                  background: 'var(--bg-surface)',
                  padding: '14px 16px',
                  borderRadius: 3,
                  border: '1px solid var(--border)',
                  borderLeft: '2px solid var(--accent)',
                }}>
                  <h3 style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: 13,
                    color: 'var(--accent)',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {personality}
                  </h3>
                  <p style={{
                    fontFamily: 'Syne, sans-serif',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.65,
                  }}>
                    {analysis}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Real-World Parallel ── */}
        <Section label="Real-World Parallel">
          <p style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 15,
            color: 'var(--text-secondary)',
            lineHeight: 1.85,
          }}>
            {report.realWorldParallel}
          </p>
        </Section>

        {/* ── Recommendations ── */}
        {report.recommendations.length > 0 && (
          <Section label="Recommendations">
            <ol style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none' }}>
              {report.recommendations.map((rec, idx) => (
                <li key={idx} style={{
                  display: 'flex',
                  gap: 14,
                  fontSize: 14,
                  lineHeight: 1.65,
                }}>
                  <span style={{
                    fontFamily: 'DM Mono, monospace',
                    color: 'var(--accent)',
                    fontWeight: 500,
                    flexShrink: 0,
                    minWidth: 22,
                    fontSize: 11,
                    paddingTop: 2,
                  }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span style={{
                    fontFamily: 'Syne, sans-serif',
                    color: 'var(--text-secondary)',
                    fontSize: 14,
                  }}>
                    {rec}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* ── Advanced Metrics ── */}
        {advancedMetrics && (
          <Section label="Analysis Metrics">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <MetricGauge
                label="Polarization Index"
                value={advancedMetrics.polarizationIndex}
                description="How split the population is across opposing states (0 = unified, 1 = fully polarized)"
                color={advancedMetrics.polarizationIndex > 0.6 ? 'var(--danger)' : advancedMetrics.polarizationIndex > 0.35 ? 'var(--warning)' : 'var(--success)'}
              />
              <MetricGauge
                label="Echo Chamber Score"
                value={advancedMetrics.echoChamberScore}
                description="Fraction of social edges connecting agents in the same state (1 = fully siloed)"
                color={advancedMetrics.echoChamberScore > 0.7 ? 'var(--danger)' : advancedMetrics.echoChamberScore > 0.45 ? 'var(--warning)' : 'var(--success)'}
              />
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 3,
                padding: '18px',
                border: '1px solid var(--border)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: 'var(--accent3)' }} />
                <div className="stat-label" style={{ marginBottom: 6 }}>Spread Speed</div>
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 24,
                  fontWeight: 500,
                  color: 'var(--accent3)',
                  marginBottom: 6,
                  letterSpacing: '-0.02em',
                }}>
                  {advancedMetrics.spreadSpeed !== null ? `T${advancedMetrics.spreadSpeed}` : '—'}
                </div>
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}>
                  Tick when seed state reached 50% of agents
                </div>
              </div>
            </div>

            {advancedMetrics.groupMetrics && (
              <div>
                <div style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  marginBottom: 10,
                }}>
                  Experimental Groups
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <GroupMetricCard label="Control Group"   counts={advancedMetrics.groupMetrics.controlStateCounts}   color="var(--accent)"  />
                  <GroupMetricCard label="Treatment Group" counts={advancedMetrics.groupMetrics.treatmentStateCounts} color="var(--accent2)" />
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 16, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(`/compare?a=${simId}`)}
            className="btn-secondary"
            style={{ padding: '12px 24px', fontSize: 11 }}
          >
            ⚖ Compare Runs
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
            style={{ padding: '12px 36px', fontSize: 12 }}
          >
            ← New Simulation
          </button>
        </div>
      </div>
    </AppShell>
  )
}

/* ── Section wrapper ── */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '28px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{ width: 3, height: 20, background: 'var(--accent)', borderRadius: 2, flexShrink: 0 }} />
        <h2 style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: 'var(--text-primary)',
        }}>
          {label}
        </h2>
      </div>
      {children}
    </div>
  )
}

/* ── Metric gauge ── */
function MetricGauge({ label, value, description, color }: { label: string; value: number; description: string; color: string }) {
  const pct = Math.round(value * 100)
  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 3,
      padding: '18px',
      border: '1px solid var(--border)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: color }} />
      <div className="stat-label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: 28,
        fontWeight: 500,
        color,
        marginBottom: 10,
        letterSpacing: '-0.03em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {pct}%
      </div>
      {/* Progress bar */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 2,
        height: 4,
        marginBottom: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 2,
          transition: 'width 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
        }} />
      </div>
      <div style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: 10,
        color: 'var(--text-muted)',
        lineHeight: 1.5,
        letterSpacing: '0.01em',
      }}>
        {description}
      </div>
    </div>
  )
}

/* ── Group metric card ── */
function GroupMetricCard({ label, counts, color }: { label: string; counts: Record<string, number>; color: string }) {
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 3,
      padding: '14px 16px',
      border: `1px solid ${color}33`,
      borderLeft: `2px solid ${color}`,
    }}>
      <div style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: 9,
        fontWeight: 500,
        color,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        {label}
      </div>
      {total === 0 ? (
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 10,
          color: 'var(--text-muted)',
        }}>
          No agents assigned
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {Object.entries(counts).map(([state, count]) => (
            <div key={state} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 12,
                color: 'var(--text-secondary)',
                textTransform: 'capitalize',
              }}>
                {state}
              </span>
              <span style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: 11,
                color: 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {count}{' '}
                <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                  ({Math.round(count / total * 100)}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
