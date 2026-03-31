import type { ThemeDef } from '../types/simulation'

interface Props {
  themes: ThemeDef[]
  selected: string
  onSelect: (key: string) => void
}

const difficultyLabel: Record<string, string> = {
  simple: 'Simple',
  medium: 'Medium',
  complex: 'Complex',
}

export default function ThemePicker({ themes, selected, onSelect }: Props) {
  return (
    <div>
      <label className="label">Choose a Simulation Theme</label>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '14px',
        marginTop: '12px',
      }}>
        {themes.map(theme => (
          <div
            key={theme.key}
            onClick={() => onSelect(theme.key)}
            className="glass glass-hover"
            style={{
              padding: '20px',
              cursor: 'pointer',
              border: selected === theme.key
                ? '1px solid var(--accent)'
                : '1px solid var(--border)',
              boxShadow: selected === theme.key
                ? '0 0 24px var(--accent-glow), inset 0 0 40px rgba(99,102,241,0.05)'
                : 'none',
              transition: 'all 0.2s',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {selected === theme.key && (
              <div style={{
                position: 'absolute', top: 10, right: 10,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)',
                boxShadow: '0 0 8px var(--accent)',
              }} />
            )}
            <div style={{ fontSize: 32, marginBottom: 10 }}>{theme.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{theme.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              {theme.description}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`badge badge-${theme.difficulty}`}>{difficultyLabel[theme.difficulty]}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {theme.states.length} states
              </span>
            </div>
            {/* State color dots */}
            <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
              {Object.entries(theme.state_colors).map(([state, color]) => (
                <div
                  key={state}
                  title={state}
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
