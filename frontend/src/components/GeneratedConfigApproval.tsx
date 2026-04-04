import { useState } from 'react'
import type { SimConfig, PersonalityDef } from '../types/simulation'

const TOPOLOGIES = ['small_world', 'scale_free', 'random', 'cluster'] as const

interface GeneratedConfigApprovalProps {
  config: SimConfig
  onApprove: (config: SimConfig) => void
  onEditTopic: () => void
}

export default function GeneratedConfigApproval({
  config,
  onApprove,
  onEditTopic,
}: GeneratedConfigApprovalProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempConfig, setTempConfig] = useState<SimConfig>(config)

  const handleEditTheme = (theme: string) => {
    setTempConfig(c => ({ ...c, theme }))
    setEditingField(null)
  }

  const handleEditAgentCount = (count: number) => {
    setTempConfig(c => ({ ...c, agent_count: count }))
    setEditingField(null)
  }

  const handleEditTopology = (topology: SimConfig['topology']) => {
    setTempConfig(c => ({ ...c, topology }))
    setEditingField(null)
  }

  const handleEditPersonalities = (personalities: PersonalityDef[]) => {
    setTempConfig(c => ({ ...c, personalities }))
    setEditingField(null)
  }

  const handleApprove = () => {
    onApprove(tempConfig)
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
          Review generated configuration
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
          Gemini has generated your simulation config. Review the settings below and make any adjustments before launching.
        </p>
      </div>

      {/* Theme */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: 'var(--bg-surface)',
          borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Theme
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>
              {tempConfig.theme}
            </div>
          </div>
          <button
            onClick={() => setEditingField('theme')}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            Edit
          </button>
        </div>
        {editingField === 'theme' && (
          <ThemeEditor value={tempConfig.theme} onSave={handleEditTheme} onCancel={() => setEditingField(null)} />
        )}
      </div>

      {/* Agent Count */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: 'var(--bg-surface)',
          borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Agent Count
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {tempConfig.agent_count} agents
            </div>
          </div>
          <button
            onClick={() => setEditingField('agent_count')}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            Edit
          </button>
        </div>
        {editingField === 'agent_count' && (
          <AgentCountEditor value={tempConfig.agent_count} onSave={handleEditAgentCount} onCancel={() => setEditingField(null)} />
        )}
      </div>

      {/* Network Topology */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: 'var(--bg-surface)',
          borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Network Topology
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>
              {tempConfig.topology.replace('_', ' ')}
            </div>
          </div>
          <button
            onClick={() => setEditingField('topology')}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            Edit
          </button>
        </div>
        {editingField === 'topology' && (
          <TopologyEditor value={tempConfig.topology} onSave={handleEditTopology} onCancel={() => setEditingField(null)} />
        )}
      </div>

      {/* Personalities */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="label">Personality Archetypes ({tempConfig.personalities.length})</div>
          <button
            onClick={() => setEditingField('personalities')}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            Edit
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tempConfig.personalities.map(p => (
            <div key={p.name} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 16px',
              background: 'var(--bg-surface)',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: p.color, flexShrink: 0, marginTop: 4,
                boxShadow: `0 0 6px ${p.color}80`,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5, marginBottom: 6 }}>
                  {p.description}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Credulity: <strong>{p.credulity}</strong></span>
                  <span>Influence: <strong>{p.influence}</strong></span>
                  <span>Stubbornness: <strong>{p.stubbornness}</strong></span>
                  <span>Activity: <strong>{p.activity}</strong></span>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                {p.suggested_percentage}%
              </div>
            </div>
          ))}
        </div>
        {editingField === 'personalities' && (
          <PersonalitiesEditor value={tempConfig.personalities} onSave={handleEditPersonalities} onCancel={() => setEditingField(null)} />
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="btn-primary glow-pulse"
          onClick={handleApprove}
          style={{ padding: '12px 32px', fontSize: 15 }}
        >
          ✦ Launch Simulation →
        </button>
        <button
          className="btn-secondary"
          onClick={onEditTopic}
          style={{ padding: '12px 20px', fontSize: 14 }}
        >
          ← Edit scenario
        </button>
      </div>
    </div>
  )
}

function ThemeEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string
  onSave: (theme: string) => void
  onCancel: () => void
}) {
  const [input, setInput] = useState(value)

  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--bg-card)',
      borderRadius: 8,
      border: '1px solid var(--accent-glow)',
      marginTop: 12,
      display: 'flex',
      gap: 12,
      alignItems: 'flex-end',
    }}>
      <div style={{ flex: 1 }}>
        <label className="label" style={{ marginBottom: 8 }}>Theme name</label>
        <input
          type="text"
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-primary"
          onClick={() => onSave(input)}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          Save
        </button>
        <button
          className="btn-secondary"
          onClick={onCancel}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function AgentCountEditor({
  value,
  onSave,
  onCancel,
}: {
  value: number
  onSave: (count: number) => void
  onCancel: () => void
}) {
  const [input, setInput] = useState(value.toString())

  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--bg-card)',
      borderRadius: 8,
      border: '1px solid var(--accent-glow)',
      marginTop: 12,
      display: 'flex',
      gap: 12,
      alignItems: 'flex-end',
    }}>
      <div style={{ flex: 1 }}>
        <label className="label" style={{ marginBottom: 8 }}>Number of agents (10-1000)</label>
        <input
          type="number"
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          min={10}
          max={1000}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-primary"
          onClick={() => onSave(Math.min(1000, Math.max(10, parseInt(input) || 100)))}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          Save
        </button>
        <button
          className="btn-secondary"
          onClick={onCancel}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function TopologyEditor({
  value,
  onSave,
  onCancel,
}: {
  value: SimConfig['topology']
  onSave: (topology: SimConfig['topology']) => void
  onCancel: () => void
}) {
  const [selected, setSelected] = useState(value)

  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--bg-card)',
      borderRadius: 8,
      border: '1px solid var(--accent-glow)',
      marginTop: 12,
    }}>
      <label className="label" style={{ marginBottom: 12 }}>Network topology</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {TOPOLOGIES.map(topo => (
          <button
            key={topo}
            onClick={() => setSelected(topo)}
            style={{
              padding: '10px 14px',
              background: selected === topo ? 'var(--accent)' : 'var(--bg-surface)',
              border: `2px solid ${selected === topo ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 6,
              color: selected === topo ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            {topo.replace('_', ' ')}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-primary"
          onClick={() => onSave(selected)}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          Save
        </button>
        <button
          className="btn-secondary"
          onClick={onCancel}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function PersonalitiesEditor({
  value,
  onSave,
  onCancel,
}: {
  value: PersonalityDef[]
  onSave: (personalities: PersonalityDef[]) => void
  onCancel: () => void
}) {
  const [personalities, setPersonalities] = useState<PersonalityDef[]>(value)

  const handleUpdatePersonality = (index: number, updates: Partial<PersonalityDef>) => {
    const updated = [...personalities]
    updated[index] = { ...updated[index], ...updates }
    setPersonalities(updated)
  }

  const totalPercentage = personalities.reduce((sum, p) => sum + p.suggested_percentage, 0)
  const isValid = Math.abs(totalPercentage - 100) <= 1

  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--bg-card)',
      borderRadius: 8,
      border: '1px solid var(--accent-glow)',
      marginTop: 12,
    }}>
      <label className="label" style={{ marginBottom: 12 }}>Adjust personality percentages (must sum to 100%)</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {personalities.map((p, idx) => (
          <div key={p.name} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            background: 'var(--bg-surface)',
            borderRadius: 6,
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: p.color, flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
            </div>
            <input
              type="number"
              value={p.suggested_percentage}
              onChange={e => handleUpdatePersonality(idx, { suggested_percentage: parseInt(e.target.value) || 0 })}
              min={0}
              max={100}
              style={{
                width: '60px',
                padding: '6px 8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                fontSize: 12,
                textAlign: 'center',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: '20px' }}>%</span>
          </div>
        ))}
      </div>

      <div style={{
        padding: '10px 12px',
        background: isValid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        borderRadius: 6,
        border: `1px solid ${isValid ? '#22c55e' : '#ef4444'}`,
        marginBottom: 16,
        fontSize: 12,
        color: isValid ? '#22c55e' : '#ef4444',
        fontWeight: 600,
      }}>
        Total: {totalPercentage}% {isValid ? '✓' : '(must be 100%)'}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-primary"
          onClick={() => onSave(personalities)}
          disabled={!isValid}
          style={{ padding: '8px 16px', fontSize: 13, opacity: isValid ? 1 : 0.5 }}
        >
          Save
        </button>
        <button
          className="btn-secondary"
          onClick={onCancel}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
