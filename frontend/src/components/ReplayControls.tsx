import type { TickMessage } from '../types/simulation'

interface ReplayControlsProps {
  history: TickMessage[]
  replayTick: number | null
  onScrub: (tick: number | null) => void
}

export default function ReplayControls({ history, replayTick, onScrub }: ReplayControlsProps) {
  if (history.length === 0) return null

  const max = history.length - 1
  const current = replayTick ?? max
  const isLive = replayTick === null
  const displayedTick = history[current]?.tick ?? 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 16px',
      background: 'rgba(8,11,20,0.85)',
      borderTop: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', userSelect: 'none' }}>
        ⏪ Replay
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={current}
        onChange={e => {
          const idx = Number(e.target.value)
          onScrub(idx >= max ? null : idx)
        }}
        style={{ flex: 1, cursor: 'pointer' }}
      />
      <span style={{
        fontSize: 11, fontWeight: 700, minWidth: 52, textAlign: 'right', userSelect: 'none',
        color: isLive ? '#22c55e' : 'var(--accent)',
      }}>
        {isLive ? '● LIVE' : `T${displayedTick}`}
      </span>
      {!isLive && (
        <button
          className="btn-secondary"
          onClick={() => onScrub(null)}
          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, borderColor: '#22c55e', color: '#22c55e', whiteSpace: 'nowrap' }}
        >
          → Live
        </button>
      )}
    </div>
  )
}
