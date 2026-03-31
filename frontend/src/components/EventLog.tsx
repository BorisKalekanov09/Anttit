import { useRef, useEffect } from 'react'
import type { TickEvent } from '../types/simulation'

interface Props {
  events: TickEvent[]
  stateColors: Record<string, string>
}

export default function EventLog({ events, stateColors }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to top (newest first)
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [events.length])

  if (events.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No events yet...
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      {events.map((ev, i) => (
        <div
          key={i}
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
      ))}
    </div>
  )
}
