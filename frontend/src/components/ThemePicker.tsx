import { useMemo } from 'react'
import type { ThemeDef } from '../types/simulation'

interface Props {
  themes: ThemeDef[]
  selected: string
  onSelect: (key: string) => void
  loading?: boolean
}

const difficultyLabel: Record<string, string> = {
  simple: 'Simple',
  medium: 'Medium',
  complex: 'Complex',
}

function buildGradient(stateColors: Record<string, string>): string {
  const colors = Object.values(stateColors)
  if (colors.length === 0) return 'linear-gradient(135deg, var(--bg-card), var(--bg-elevated))'
  if (colors.length === 1) return `linear-gradient(135deg, ${colors[0]}22, ${colors[0]}08)`
  const stops = colors.map((c, i) => `${c}18 ${(i / (colors.length - 1)) * 100}%`).join(', ')
  return `linear-gradient(135deg, ${stops})`
}

function SkeletonCard() {
  return (
    <div
      className="glass"
      style={{
        width: 300,
        height: 220,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        gap: 12,
      }}
    >
      <div className="skeleton" style={{ width: 50, height: 50, borderRadius: 12 }} />
      <div className="skeleton" style={{ width: '70%', height: 20, marginTop: 4 }} />
      <div className="skeleton" style={{ width: '100%', height: 14 }} />
      <div className="skeleton" style={{ width: '85%', height: 14 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <div className="skeleton" style={{ width: 70, height: 24, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: 60, height: 24, borderRadius: 12 }} />
      </div>
    </div>
  )
}

export default function ThemePicker({ themes, selected, onSelect, loading }: Props) {
  const hasThemes = themes.length > 0

  return (
    <div>
      <label className="label">Choose a Simulation Theme</label>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 14,
          overflowX: 'auto',
          paddingBottom: 12,
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
        }}
      >
        {loading || !hasThemes ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          themes.map(theme => (
            <ThemeCard
              key={theme.key}
              theme={theme}
              isSelected={selected === theme.key}
              onSelect={() => onSelect(theme.key)}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface ThemeCardProps {
  theme: ThemeDef
  isSelected: boolean
  onSelect: () => void
}

function ThemeCard({ theme, isSelected, onSelect }: ThemeCardProps) {
  const gradient = useMemo(() => buildGradient(theme.state_colors), [theme.state_colors])

  return (
    <div
      onClick={onSelect}
      className="glass glass-hover"
      style={{
        width: 300,
        height: 220,
        flexShrink: 0,
        padding: 24,
        cursor: 'pointer',
        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
        boxShadow: isSelected
          ? '0 0 32px var(--accent-glow), inset 0 0 60px rgba(124,109,250,0.04)'
          : 'none',
        transition: 'all 0.25s cubic-bezier(0.23,1,0.32,1)',
        position: 'relative',
        overflow: 'hidden',
        scrollSnapAlign: 'start',
        display: 'flex',
        flexDirection: 'column',
        background: gradient,
      }}
    >
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 12px var(--accent)',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${Object.values(theme.state_colors)[0] ?? 'var(--accent)'}15, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -40,
          left: -20,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${Object.values(theme.state_colors)[1] ?? 'var(--accent2)'}12, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          fontSize: 42,
          marginBottom: 8,
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
        }}
      >
        {theme.emoji}
      </div>

      <div
        style={{
          fontWeight: 800,
          fontSize: 18,
          marginBottom: 6,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}
      >
        {theme.name}
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          flex: 1,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {theme.description}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge badge-${theme.difficulty}`}>
            {difficultyLabel[theme.difficulty]}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {theme.states.length} states
          </span>
        </div>

        <div style={{ display: 'flex', gap: 5 }}>
          {Object.entries(theme.state_colors).map(([state, color]) => (
            <div
              key={state}
              title={state}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 8px ${color}`,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
