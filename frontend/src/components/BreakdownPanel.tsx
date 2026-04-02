import { useRef, useEffect } from 'react'
import type { TickMessage } from '../types/simulation'

interface Props {
  latestTick: TickMessage | null
  stateColors: Record<string, string>
  states: string[]
  previousTick?: TickMessage | null
}

type AgentRole = 'influencer' | 'skeptic' | 'bot' | 'follower'

const ROLE_COLORS: Record<AgentRole, string> = {
  influencer: '#f59e0b',
  skeptic: '#ef4444',
  bot: '#8b5cf6',
  follower: '#6b7280',
}

const ROLE_ICONS: Record<AgentRole, string> = {
  influencer: '⭐',
  skeptic: '🔒',
  bot: '🤖',
  follower: '👤',
}

function DeltaIndicator({ delta }: { delta: number }) {
  if (delta === 0) return null
  const isPositive = delta > 0
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: isPositive ? 'var(--success)' : 'var(--danger)',
        marginLeft: 4,
      }}
    >
      {isPositive ? '+' : ''}{delta}
    </span>
  )
}

export default function BreakdownPanel({ latestTick, stateColors, states, previousTick }: Props) {
  const prevCountsRef = useRef<Record<string, Record<string, number>>>({})

  useEffect(() => {
    if (previousTick) {
      prevCountsRef.current = previousTick.breakdown
    }
  }, [previousTick])

  if (!latestTick) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Waiting for data...
      </div>
    )
  }

  const breakdown = latestTick.breakdown
  const personalities = Object.keys(breakdown)
  const roleBreakdown = latestTick.role_breakdown

  const getDelta = (personality: string, state: string): number => {
    const prev = prevCountsRef.current[personality]?.[state] ?? 0
    const curr = breakdown[personality]?.[state] ?? 0
    return curr - prev
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', height: '100%' }}>
      {personalities.map(pName => {
        const counts = breakdown[pName]
        const total = Object.values(counts).reduce((a, b) => a + b, 0)
        if (total === 0) return null

        return (
          <div key={pName}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{pName}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total} agents</span>
            </div>
            <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', gap: 1, background: 'var(--bg-surface)' }}>
              {states.map(state => {
                const count = counts[state] ?? 0
                const pct = (count / total) * 100
                if (pct < 0.5) return null
                return (
                  <div
                    key={state}
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(180deg, ${stateColors[state] ?? '#888'}cc, ${stateColors[state] ?? '#888'})`,
                      transition: 'width 0.5s cubic-bezier(0.23,1,0.32,1)',
                      position: 'relative',
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15)`,
                    }}
                    title={`${state}: ${count} (${pct.toFixed(1)}%)`}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              {states.map(state => {
                const count = counts[state] ?? 0
                if (count === 0) return null
                const delta = getDelta(pName, state)
                return (
                  <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: stateColors[state] ?? '#888',
                        boxShadow: `0 0 4px ${stateColors[state] ?? '#888'}`,
                      }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {state.replace(/_/g, ' ')} {count}
                    </span>
                    <DeltaIndicator delta={delta} />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {roleBreakdown && Object.keys(roleBreakdown).length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
            Role Distribution
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {(Object.entries(roleBreakdown) as [AgentRole, number][]).map(([role, count]) => {
              const totalAgents = latestTick.total_agents
              const pct = totalAgents > 0 ? ((count / totalAgents) * 100).toFixed(1) : '0'
              return (
                <div
                  key={role}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    background: 'var(--bg-surface)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{ROLE_ICONS[role] ?? '❓'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: ROLE_COLORS[role] ?? 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {role}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {count} ({pct}%)
                    </div>
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--bg-card)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: ROLE_COLORS[role] ?? 'var(--accent)',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
