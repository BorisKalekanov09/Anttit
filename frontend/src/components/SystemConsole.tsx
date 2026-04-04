import { useMemo } from 'react'
import type { TickMessage } from '../types/simulation'

interface Props {
  history: TickMessage[]
}

export default function SystemConsole({ history }: Props) {
  const logEntries = useMemo(() => {
    return history.slice(-50)
  }, [history])

  return (
    <div data-testid="system-console" style={{
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
        <span>SYSTEM CONSOLE</span>
        <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>
          {logEntries.length} entries
        </span>
      </div>

      <div style={{
        flex: 1,
        padding: '12px 16px',
        overflow: 'auto',
        fontFamily: '"Monaco", "Courier New", monospace',
        fontSize: 11,
        lineHeight: 1.6,
        color: 'var(--text-secondary)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {logEntries.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            No log entries yet
          </div>
        ) : (
          logEntries.map((entry, i) => {
            const stateCounts = entry.state_counts
            const dominantState = Object.entries(stateCounts).length > 0
              ? Object.entries(stateCounts).sort(([, a], [, b]) => b - a)[0][0]
              : 'unknown'

            const eventCount = entry.events.length

            const logLine = `T${entry.tick.toString().padStart(4)} | ${dominantState.replace(/_/g, ' ').padEnd(20)} | ${entry.total_agents.toString().padStart(4)} agents | ${eventCount} events`

            return (
              <div
                key={i}
                style={{
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {logLine}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
