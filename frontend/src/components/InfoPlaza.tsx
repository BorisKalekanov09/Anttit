import { useState } from 'react'
import type { TickEvent, TickMessage } from '../types/simulation'

interface Props {
  tick: number
  totalAgents: number
  events: TickEvent[]
  discussionPostCount: number
  latestTick: TickMessage | null
  whatIfInput: string
  onWhatIfInputChange: (value: string) => void
  onWhatIfPreview: () => void
  whatIfLoading: boolean
  stateColors: Record<string, string>
}

export default function InfoPlaza({
  tick,
  totalAgents,
  events,
  discussionPostCount,
  whatIfInput,
  onWhatIfInputChange,
  onWhatIfPreview,
  whatIfLoading,
  stateColors,
}: Props) {
  const [showWhatIf, setShowWhatIf] = useState(false)

  const recentEvents = events.slice(0, 5)

  return (
    <div data-testid="info-plaza" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
    }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        fontWeight: 700,
        fontSize: 13,
        color: 'var(--text-secondary)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>INFO PLAZA</span>
      </div>

      <div style={{
        flex: 1,
        padding: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Live Stats
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Current Tick:</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{tick}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Agents:</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{totalAgents}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Events:</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{events.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Discussion Posts:</span>
              <span style={{ fontWeight: 700, color: 'var(--accent2)' }}>{discussionPostCount}</span>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Recent Events ({recentEvents.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentEvents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 16 }}>
                No events yet
              </div>
            ) : (
              recentEvents.map((ev, i) => (
                <div key={`${ev.tick}-${ev.agent_id}-${i}`} style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  padding: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 8,
                  lineHeight: 1.4,
                }}>
                  <div style={{ marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)' }}>T{ev.tick}</span>
                    <span style={{ fontWeight: 600 }}>Agent {ev.agent_id}</span>
                    <span style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--text-secondary)',
                      marginLeft: 6,
                    }}>
                      {ev.personality}
                    </span>
                    {ev.ai && <span style={{ color: 'var(--accent2)', marginLeft: 4 }}>✦ AI</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10 }}>
                    <span style={{ color: stateColors[ev.from_state] ?? '#888', fontWeight: 600 }}>
                      {ev.from_state.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span style={{ color: stateColors[ev.to_state] ?? '#888', fontWeight: 600 }}>
                      {ev.to_state.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <button
            onClick={() => setShowWhatIf(!showWhatIf)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: 8,
              width: '100%',
            }}
          >
            <span style={{ fontSize: 14 }}>{showWhatIf ? '▼' : '▶'}</span>
            {'🔮 What-If Mode'}
          </button>

          {showWhatIf && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                }}>
                  Scenario
                </label>
                <textarea
                  value={whatIfInput}
                  onChange={e => onWhatIfInputChange(e.target.value)}
                  placeholder="Describe a hypothetical event or intervention..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 12,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontFamily: 'Inter, sans-serif',
                    lineHeight: 1.5,
                    resize: 'vertical',
                  }}
                />
              </div>

              <button
                onClick={onWhatIfPreview}
                disabled={whatIfLoading || !whatIfInput.trim()}
                style={{
                  background: 'var(--gradient-accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: whatIfLoading || !whatIfInput.trim() ? 'not-allowed' : 'pointer',
                  opacity: whatIfLoading || !whatIfInput.trim() ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {whatIfLoading ? '⏳ Analyzing...' : '🔮 Preview Impact'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
