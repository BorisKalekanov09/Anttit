import React from 'react'

interface TopologyPreviewProps {
  topology: 'small_world' | 'scale_free' | 'random' | 'grid'
  onSelect: (topology: 'small_world' | 'scale_free' | 'random' | 'grid') => void
}

const topologies = [
  {
    id: 'small_world',
    name: 'Small World',
    description: 'Clustered with shortcuts',
    icon: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="30" cy="30" r="3" fill="currentColor" />
        <circle cx="70" cy="30" r="3" fill="currentColor" />
        <circle cx="30" cy="70" r="3" fill="currentColor" />
        <circle cx="70" cy="70" r="3" fill="currentColor" />
        <circle cx="50" cy="50" r="3" fill="currentColor" />
        <line x1="30" y1="30" x2="50" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="70" y1="30" x2="50" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="30" y1="70" x2="50" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="70" y1="70" x2="50" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="30" y1="30" x2="70" y2="30" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
        <line x1="30" y1="30" x2="30" y2="70" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      </svg>
    ),
  },
  {
    id: 'scale_free',
    name: 'Scale-Free',
    description: 'Hub-and-spoke',
    icon: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r="5" fill="currentColor" />
        <circle cx="20" cy="20" r="2" fill="currentColor" />
        <circle cx="80" cy="20" r="2" fill="currentColor" />
        <circle cx="20" cy="80" r="2" fill="currentColor" />
        <circle cx="80" cy="80" r="2" fill="currentColor" />
        <circle cx="50" cy="15" r="2" fill="currentColor" />
        <circle cx="85" cy="50" r="2" fill="currentColor" />
        <line x1="50" y1="50" x2="20" y2="20" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="50" y1="50" x2="80" y2="20" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="50" y1="50" x2="20" y2="80" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="50" y1="50" x2="80" y2="80" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="50" y1="50" x2="50" y2="15" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="50" y1="50" x2="85" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: 'random',
    name: 'Random',
    description: 'Uniform connections',
    icon: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="25" cy="25" r="2" fill="currentColor" />
        <circle cx="75" cy="25" r="2" fill="currentColor" />
        <circle cx="25" cy="75" r="2" fill="currentColor" />
        <circle cx="75" cy="75" r="2" fill="currentColor" />
        <circle cx="50" cy="50" r="2" fill="currentColor" />
        <line x1="25" y1="25" x2="75" y2="25" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
        <line x1="25" y1="25" x2="25" y2="75" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
        <line x1="75" y1="25" x2="75" y2="75" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
        <line x1="25" y1="75" x2="75" y2="75" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
        <line x1="50" y1="50" x2="25" y2="25" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
        <line x1="50" y1="50" x2="75" y2="75" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
      </svg>
    ),
  },
  {
    id: 'grid',
    name: 'Grid',
    description: 'Lattice structure',
    icon: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="25" cy="25" r="2" fill="currentColor" />
        <circle cx="50" cy="25" r="2" fill="currentColor" />
        <circle cx="75" cy="25" r="2" fill="currentColor" />
        <circle cx="25" cy="50" r="2" fill="currentColor" />
        <circle cx="50" cy="50" r="2" fill="currentColor" />
        <circle cx="75" cy="50" r="2" fill="currentColor" />
        <circle cx="25" cy="75" r="2" fill="currentColor" />
        <circle cx="50" cy="75" r="2" fill="currentColor" />
        <circle cx="75" cy="75" r="2" fill="currentColor" />
        <line x1="25" y1="25" x2="50" y2="25" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="50" y1="25" x2="75" y2="25" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="25" y1="25" x2="25" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="25" y1="50" x2="25" y2="75" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="50" y1="25" x2="50" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="50" y1="50" x2="50" y2="75" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="75" y1="25" x2="75" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="75" y1="50" x2="75" y2="75" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="25" y1="50" x2="50" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="50" y1="50" x2="75" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
      </svg>
    ),
  },
]

export const TopologyPreview: React.FC<TopologyPreviewProps> = ({ topology, onSelect }) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {topologies.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id as any)}
          className={`
            topology-card group
            ${topology === t.id ? 'selected' : ''}
          `}
        >
          <div className="h-24 text-[var(--text-secondary)] group-hover:text-[var(--accent)] mb-3 transition-colors">
            {t.icon}
          </div>
          <h3 className="font-semibold text-sm text-[var(--text-primary)]">{t.name}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t.description}</p>
        </button>
      ))}
    </div>
  )
}
