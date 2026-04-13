import { useState, useMemo } from 'react'
import type { InitMessage, TickMessage } from '../types/simulation'

interface AgentSearchPanelProps {
  initData: InitMessage | null
  latestTick: TickMessage | null
  stateColors: Record<string, string>
  states: string[]
  highlightState: string | null
  onHighlightState: (state: string | null) => void
  onSelectAgent: (agentId: string) => void
  onClose: () => void
}

export default function AgentSearchPanel({
  initData,
  latestTick,
  stateColors,
  states,
  highlightState,
  onHighlightState,
  onSelectAgent,
  onClose,
}: AgentSearchPanelProps) {
  const [query, setQuery] = useState('')

  const agents = useMemo(() => {
    if (!latestTick?.node_states) return []
    return Object.entries(latestTick.node_states).map(([id, state]) => {
      const profile = initData?.agentProfiles?.find(p => p.id === id)
      return { id, state, personality: profile?.personality ?? '' }
    })
  }, [initData, latestTick])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return agents.filter(a =>
      (!q || a.id.includes(q) || a.personality.toLowerCase().includes(q)) &&
      (!highlightState || a.state === highlightState)
    )
  }, [agents, query, highlightState])

  return (
    <div style={{
      position: 'absolute', top: 48, right: 8, zIndex: 50,
      width: 260,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      maxHeight: 420,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
          AGENT SEARCH
        </span>
        <button className="btn-icon" onClick={onClose} style={{ fontSize: 12, padding: '2px 6px' }}>✕</button>
      </div>

      {/* Search input */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <input
          type="text"
          placeholder="Search by ID or personality…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          style={{
            width: '100%', padding: '6px 10px', fontSize: 12,
            borderRadius: 6, border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>

      {/* State filter pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => onHighlightState(null)}
          style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${highlightState === null ? 'var(--accent)' : 'var(--border)'}`,
            background: highlightState === null ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: highlightState === null ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          All
        </button>
        {states.map(s => {
          const color = stateColors[s] ?? '#888'
          const isActive = highlightState === s
          return (
            <button
              key={s}
              onClick={() => onHighlightState(isActive ? null : s)}
              style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${isActive ? color : 'var(--border)'}`,
                background: isActive ? `${color}22` : 'transparent',
                color: isActive ? color : 'var(--text-muted)',
              }}
            >
              {s.replace(/_/g, ' ')}
            </button>
          )
        })}
      </div>

      {/* Results */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            No agents match
          </div>
        ) : filtered.slice(0, 100).map(a => {
          const color = stateColors[a.state] ?? '#888'
          return (
            <button
              key={a.id}
              onClick={() => onSelectAgent(a.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px',
                background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Agent {a.id}
                </div>
                {a.personality && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.personality}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${color}22`, color, fontWeight: 600, textTransform: 'uppercase', flexShrink: 0 }}>
                {a.state.replace(/_/g, ' ')}
              </span>
            </button>
          )
        })}
        {filtered.length > 100 && (
          <div style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            +{filtered.length - 100} more — refine your search
          </div>
        )}
      </div>
    </div>
  )
}
