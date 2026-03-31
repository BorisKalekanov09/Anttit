import type { TickMessage } from '../types/simulation'

interface Props {
  latestTick: TickMessage | null
  stateColors: Record<string, string>
  states: string[]
}

export default function BreakdownPanel({ latestTick, stateColors, states }: Props) {
  if (!latestTick) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Waiting for data...
      </div>
    )
  }

  const breakdown = latestTick.breakdown
  const personalities = Object.keys(breakdown)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', height: '100%' }}>
      {personalities.map(pName => {
        const counts = breakdown[pName]
        const total = Object.values(counts).reduce((a, b) => a + b, 0)
        if (total === 0) return null

        return (
          <div key={pName}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{pName}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total} agents</span>
            </div>
            {/* Stacked bar */}
            <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', gap: 1 }}>
              {states.map(state => {
                const count = counts[state] ?? 0
                const pct = (count / total) * 100
                if (pct < 0.5) return null
                return (
                  <div
                    key={state}
                    style={{
                      width: `${pct}%`,
                      background: stateColors[state] ?? '#888',
                      transition: 'width 0.4s ease',
                      position: 'relative',
                    }}
                    title={`${state}: ${count} (${pct.toFixed(1)}%)`}
                  />
                )
              })}
            </div>
            {/* Mini legend */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {states.map(state => {
                const count = counts[state] ?? 0
                if (count === 0) return null
                return (
                  <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: stateColors[state] ?? '#888' }} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {state.replace(/_/g, ' ')} {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
