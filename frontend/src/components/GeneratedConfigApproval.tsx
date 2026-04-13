import React, { useState, useEffect } from 'react'
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
  const [costEstimate, setCostEstimate] = useState<{ estimatedUsd: number | null; modelName: string; note?: string } | null>(null)

  useEffect(() => {
    const modelId = tempConfig.modelName ?? 'gemini-2.5-flash-lite'
    fetch(`/api/config/estimate-cost?modelId=${encodeURIComponent(modelId)}&agent_count=${tempConfig.agent_count}&tick_count=100`)
      .then(r => r.json())
      .then(setCostEstimate)
      .catch(() => {})
  }, [tempConfig.modelName, tempConfig.agent_count])

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

      {/* Cost estimate */}
      {costEstimate && (
        <div style={{
          marginBottom: 20, padding: '10px 16px', borderRadius: 8,
          background: costEstimate.estimatedUsd !== null && costEstimate.estimatedUsd > 0.5
            ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)',
          border: `1px solid ${costEstimate.estimatedUsd !== null && costEstimate.estimatedUsd > 0.5 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.2)'}`,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
        }}>
          <span style={{ fontSize: 16 }}>
            {costEstimate.estimatedUsd !== null && costEstimate.estimatedUsd > 0.5 ? '⚠️' : '💰'}
          </span>
          <div>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {costEstimate.estimatedUsd !== null
                ? `~$${costEstimate.estimatedUsd.toFixed(4)} est.`
                : costEstimate.note ?? 'Free tier'}
            </span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
              for 100 ticks · {costEstimate.modelName}
            </span>
          </div>
        </div>
      )}

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

const TRAIT_INPUT_STYLE: React.CSSProperties = {
  width: '56px',
  padding: '4px 6px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: 12,
  textAlign: 'center',
}

const VIBRANT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e',
]

function PersonalityRow({
  personality,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  personality: PersonalityDef
  index: number
  onUpdate: (updates: Partial<PersonalityDef>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 8,
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <input
          type="color"
          value={personality.color}
          onChange={e => onUpdate({ color: e.target.value })}
          style={{ width: 24, height: 24, border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'none' }}
          title="Pick color"
        />
        <input
          value={personality.name}
          onChange={e => onUpdate({ name: e.target.value })}
          placeholder="Name"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 700,
            padding: '2px 0',
            outline: 'none',
          }}
        />
        <input
          type="number"
          value={personality.suggested_percentage}
          onChange={e => onUpdate({ suggested_percentage: parseInt(e.target.value) || 0 })}
          min={0}
          max={100}
          style={{ ...TRAIT_INPUT_STYLE, width: '48px' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 16, padding: '2px 4px',
          }}
          title={expanded ? 'Collapse' : 'Edit details'}
        >
          {expanded ? '▲' : '▼'}
        </button>
        {canRemove && (
          <button
            onClick={onRemove}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#ef4444', fontSize: 15, padding: '2px 4px',
            }}
            title="Remove"
          >
            ✕
          </button>
        )}
      </div>

      {/* Expanded detail editor */}
      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
          <textarea
            value={personality.description}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Description..."
            rows={2}
            style={{
              width: '100%',
              marginTop: 10,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-secondary)',
              fontSize: 12,
              padding: '6px 8px',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            {(['credulity', 'influence', 'stubbornness', 'activity'] as const).map(trait => (
              <label key={trait} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                {trait.charAt(0).toUpperCase() + trait.slice(1)}
                <input
                  type="number"
                  value={personality[trait]}
                  onChange={e => onUpdate({ [trait]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                  min={0}
                  max={100}
                  style={TRAIT_INPUT_STYLE}
                />
              </label>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Quick colors</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {VIBRANT_COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => onUpdate({ color: c })}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: personality.color === c ? '2px solid white' : '2px solid transparent',
                    transition: 'transform 0.1s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
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

  const update = (index: number, updates: Partial<PersonalityDef>) => {
    setPersonalities(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  const remove = (index: number) => {
    setPersonalities(prev => prev.filter((_, i) => i !== index))
  }

  const add = () => {
    const remaining = Math.max(1, 100 - personalities.reduce((s, p) => s + p.suggested_percentage, 0))
    setPersonalities(prev => [...prev, {
      name: 'New Archetype',
      description: 'Describe this personality...',
      credulity: 50,
      influence: 50,
      stubbornness: 50,
      activity: 50,
      suggested_percentage: Math.min(remaining, 10),
      color: VIBRANT_COLORS[prev.length % VIBRANT_COLORS.length],
    }])
  }

  const totalPercentage = personalities.reduce((sum, p) => sum + p.suggested_percentage, 0)
  const isValid = Math.abs(totalPercentage - 100) <= 1 && personalities.length > 0

  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--bg-card)',
      borderRadius: 8,
      border: '1px solid var(--accent-glow)',
      marginTop: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <label className="label">Personality Archetypes — edit, add, or remove</label>
        <button
          className="btn-secondary"
          onClick={add}
          style={{ padding: '6px 14px', fontSize: 12 }}
        >
          + Add
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {personalities.map((p, idx) => (
          <PersonalityRow
            key={idx}
            personality={p}
            index={idx}
            onUpdate={updates => update(idx, updates)}
            onRemove={() => remove(idx)}
            canRemove={personalities.length > 1}
          />
        ))}
      </div>

      <div style={{
        padding: '8px 12px',
        background: isValid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        borderRadius: 6,
        border: `1px solid ${isValid ? '#22c55e' : '#ef4444'}`,
        marginBottom: 14,
        fontSize: 12,
        color: isValid ? '#22c55e' : '#ef4444',
        fontWeight: 600,
      }}>
        Total: {totalPercentage}% {isValid ? '✓' : '— must sum to 100%'}
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
