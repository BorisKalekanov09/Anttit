import { useRef, useEffect, useState, useMemo } from 'react'
import type { TickEvent } from '../types/simulation'

interface Props {
  events: TickEvent[]
  stateColors: Record<string, string>
}

type FilterType = 'all' | 'ai' | 'rule'

function getEmotionalEmoji(emotionalState: number | undefined): string {
  if (emotionalState === undefined) return ''
  if (emotionalState <= -0.6) return '😰'
  if (emotionalState <= -0.2) return '😟'
  if (emotionalState <= 0.2) return '😐'
  if (emotionalState <= 0.6) return '🙂'
  return '😊'
}

export default function EventLog({ events, stateColors }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [events.length])

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      if (filter === 'ai' && !ev.ai) return false
      if (filter === 'rule' && ev.ai) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesAgent = ev.agent_id.toLowerCase().includes(q)
        const matchesPersonality = ev.personality.toLowerCase().includes(q)
        const matchesState = ev.from_state.toLowerCase().includes(q) || ev.to_state.toLowerCase().includes(q)
        const matchesReason = ev.reason.toLowerCase().includes(q)
        if (!matchesAgent && !matchesPersonality && !matchesState && !matchesReason) return false
      }
      return true
    })
  }, [events, filter, searchQuery])

  const filterPills: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ai', label: 'AI' },
    { key: 'rule', label: 'Rule' },
  ]

  if (events.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No events yet...
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {filterPills.map(pill => (
            <button
              key={pill.key}
              onClick={() => setFilter(pill.key)}
              className={filter === pill.key ? 'btn-primary' : 'btn-secondary'}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 20,
                minWidth: 50,
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="input"
          placeholder="Search events..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 120,
            padding: '6px 12px',
            fontSize: 12,
            borderRadius: 20,
          }}
        />
      </div>

      <div
        ref={listRef}
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 20 }}>
            No matching events
          </div>
        ) : (
          filteredEvents.map((ev, i) => (
            <div
              key={`${ev.tick}-${ev.agent_id}-${i}`}
              className={`event-log-entry ${ev.ai ? 'ai' : 'rule'}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>T{ev.tick}</span>
                <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-primary)' }}>
                  Agent {ev.agent_id}
                </span>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                }}>
                  {ev.personality}
                </span>
                {ev.ai && (
                  <span style={{ fontSize: 10, color: 'var(--accent2)', fontWeight: 600 }}>✦ AI</span>
                )}
                {ev.ai && ev.emotionalState !== undefined && (
                  <span
                    title={`Emotional: ${ev.emotionalState.toFixed(2)}`}
                    style={{ fontSize: 14, marginLeft: 2 }}
                  >
                    {getEmotionalEmoji(ev.emotionalState)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  color: stateColors[ev.from_state] ?? '#888',
                  fontWeight: 600, fontSize: 11,
                }}>
                  {ev.from_state.replace(/_/g, ' ')}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>→</span>
                <span style={{
                  color: stateColors[ev.to_state] ?? '#888',
                  fontWeight: 600, fontSize: 11,
                }}>
                  {ev.to_state.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>
                {ev.reason}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Showing {filteredEvents.length} of {events.length} events
      </div>
    </div>
  )
}
