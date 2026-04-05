import type { TickEvent } from '../types/simulation'

interface Props {
  tick: number
  totalAgents: number
  events: TickEvent[]
  apiCallCount: number
  totalTokensUsed: number
}

export default function InfoPlaza({
  tick,
  totalAgents,
  events,
  apiCallCount,
  totalTokensUsed,
}: Props) {

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
      {/* Header with title and live indicator */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            📊 Simulation Log
          </span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: 4,
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#22c55e' }}>LIVE</span>
          </div>
        </div>
      </div>

       {/* Main scrollable content */}
       <div style={{
         flex: 1,
         display: 'flex',
         flexDirection: 'column',
         minHeight: 0,
         overflow: 'hidden',
         justifyContent: 'center',
         alignItems: 'center',
       }}>
          {/* Stats row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.01)',
            width: '100%',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Tick</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{tick}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Agents</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{totalAgents}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Events</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent2)' }}>{events.length}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>API Calls</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{apiCallCount}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Tokens</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent2)' }}>{totalTokensUsed}</div>
            </div>
          </div>

          {/* Message */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            padding: '24px',
          }}>
            Events are displayed in Topic Community
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    )
  }
