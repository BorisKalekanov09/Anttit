import type { TickEvent } from '../types/simulation'

interface Props {
  tick: number
  totalAgents: number
  events: TickEvent[]
  apiCallCount: number
  totalTokensUsed: number
}

const STAT_ITEMS = (tick: number, totalAgents: number, events: TickEvent[], apiCallCount: number, totalTokensUsed: number) => [
  { label: 'Tick',      value: tick,                  accent: 'var(--accent)'  },
  { label: 'Agents',    value: totalAgents,            accent: 'var(--accent)'  },
  { label: 'Events',    value: events.length,          accent: 'var(--accent2)' },
  { label: 'API Calls', value: apiCallCount,           accent: 'var(--accent)'  },
  { label: 'Tokens',    value: totalTokensUsed,        accent: 'var(--accent3)' },
]

export default function InfoPlaza({ tick, totalAgents, events, apiCallCount, totalTokensUsed }: Props) {
  const items = STAT_ITEMS(tick, totalAgents, events, apiCallCount, totalTokensUsed)

  return (
    <div data-testid="info-plaza" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(232, 160, 32, 0.03)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 9,
            fontWeight: 400,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            Simulation Log
          </span>
          {/* Live indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '1px 6px',
            background: 'rgba(74, 222, 128, 0.08)',
            borderRadius: 2,
            border: '1px solid rgba(74, 222, 128, 0.2)',
          }}>
            <div style={{
              width: 5, height: 5,
              borderRadius: '50%',
              background: '#4ADE80',
              animation: 'liveBlip 2s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: '0.1em',
              color: '#4ADE80',
            }}>
              LIVE
            </span>
          </div>
        </div>

        {/* Tick counter badge */}
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 10,
          color: 'var(--accent)',
          letterSpacing: '0.04em',
        }}>
          T:{tick}
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {items.map((item, i) => (
          <div key={item.label} style={{
            padding: '12px 8px',
            textAlign: 'center',
            borderRight: i < items.length - 1 ? '1px solid var(--border)' : 'none',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Top accent line */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 2,
              background: item.accent,
              opacity: 0.6,
            }} />
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 7,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 5,
            }}>
              {item.label}
            </div>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 17,
              fontWeight: 500,
              color: item.accent,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>
              {item.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* ── Body message ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}>
        <p style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 10,
          color: 'var(--text-muted)',
          textAlign: 'center',
          letterSpacing: '0.04em',
          lineHeight: 1.6,
        }}>
          Events displayed in Topic Community
        </p>
      </div>

      <style>{`
        @keyframes liveBlip {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}
