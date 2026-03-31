import { useState, useCallback } from 'react'
import type { PersonalityDef } from '../types/simulation'
import toast from 'react-hot-toast'

interface Props {
  personalities: PersonalityDef[]
  onChange: (personalities: PersonalityDef[]) => void
  theme: string
}

const TRAIT_LABELS: Record<string, string> = {
  credulity: 'Credulity',
  influence: 'Influence',
  stubbornness: 'Stubbornness',
  activity: 'Activity',
}

const TRAIT_COLORS: Record<string, string> = {
  credulity: '#6366f1',
  influence: '#ec4899',
  stubbornness: '#f59e0b',
  activity: '#22c55e',
}

const DEFAULT_COLORS = ['#6366f1','#06b6d4','#ec4899','#f59e0b','#22c55e','#a855f7','#e74c3c','#2ecc71']

function clamp(v: number) { return Math.max(0, Math.min(100, v)) }

export default function PersonalityManager({ personalities, onChange, theme }: Props) {
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiPrompt, setAIPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [aiPreview, setAIPreview] = useState<PersonalityDef[] | null>(null)

  const normalize = useCallback((list: PersonalityDef[]) => {
    const total = list.reduce((s, p) => s + p.suggested_percentage, 0)
    if (total === 0 || list.length === 0) return list
    const scaled = list.map(p => ({ ...p, suggested_percentage: Math.round(p.suggested_percentage * 100 / total) }))
    const diff = 100 - scaled.reduce((s, p) => s + p.suggested_percentage, 0)
    if (scaled.length) scaled[0].suggested_percentage += diff
    return scaled
  }, [])

  const addPersonality = () => {
    const defaultPct = Math.round(100 / (personalities.length + 1))
    const newP: PersonalityDef = {
      name: `Type ${personalities.length + 1}`,
      description: '',
      credulity: 50, influence: 50, stubbornness: 50, activity: 50,
      suggested_percentage: defaultPct,
      color: DEFAULT_COLORS[personalities.length % DEFAULT_COLORS.length],
    }
    onChange(normalize([...personalities, newP]))
  }

  const removePersonality = (idx: number) => {
    const updated = personalities.filter((_, i) => i !== idx)
    onChange(normalize(updated))
  }

  const updatePersonality = (idx: number, patch: Partial<PersonalityDef>) => {
    const updated = personalities.map((p, i) => i === idx ? { ...p, ...patch } : p)
    onChange(updated)
  }

  const generateAI = async () => {
    if (!aiPrompt.trim()) return toast.error('Describe the society first')
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-personalities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, description: aiPrompt }),
      })
      const data = await res.json()
      if (data.personalities) {
        setAIPreview(data.personalities)
      } else throw new Error(data.detail || 'Generation failed')
    } catch (e: any) {
      toast.error(e.message || 'Gemini generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const acceptAI = () => {
    if (aiPreview) {
      onChange(normalize(aiPreview))
      setShowAIModal(false)
      setAIPreview(null)
      setAIPrompt('')
      toast.success('Personalities imported!')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <label className="label" style={{ marginBottom: 0 }}>Agent Personalities</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setShowAIModal(true)} style={{ fontSize: 13, padding: '8px 16px' }}>
            ✨ Generate with AI
          </button>
          <button className="btn-secondary" onClick={addPersonality} style={{ fontSize: 13, padding: '8px 16px' }}>
            + Add Type
          </button>
        </div>
      </div>

      {/* Percentage summary bar */}
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16, background: 'var(--bg-surface)' }}>
        {personalities.map((p, i) => (
          <div
            key={i}
            style={{
              width: `${p.suggested_percentage}%`,
              background: p.color,
              transition: 'width 0.3s',
              minWidth: p.suggested_percentage > 0 ? 2 : 0,
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {personalities.map((p, idx) => (
          <PersonalityCard
            key={idx}
            personality={p}
            onUpdate={patch => updatePersonality(idx, patch)}
            onRemove={() => removePersonality(idx)}
            canRemove={personalities.length > 1}
          />
        ))}
      </div>

      {/* AI Modal */}
      {showAIModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAIModal(false) }}>
          <div className="modal">
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>✨ Generate with Gemini</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                Describe the society you want to simulate. Gemini will create personality types with appropriate traits.
              </p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Describe your society</label>
              <textarea
                className="input"
                value={aiPrompt}
                onChange={e => setAIPrompt(e.target.value)}
                placeholder={`e.g. "A social network with influencers, skeptics, and passive scrollers who rarely engage"`}
                rows={3}
                style={{ resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
            {aiPreview ? (
              <div>
                <div style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
                  Preview — edit before accepting:
                </div>
                {aiPreview.map((p, i) => (
                  <div key={i} className="glass" style={{ padding: '12px 16px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{p.description}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                      {p.suggested_percentage}%
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn-primary" onClick={acceptAI} style={{ flex: 1 }}>Accept</button>
                  <button className="btn-secondary" onClick={() => setAIPreview(null)}>Re-generate</button>
                  <button className="btn-secondary" onClick={() => setShowAIModal(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={generateAI}
                  disabled={generating}
                  style={{ flex: 1 }}
                >
                  {generating ? '⏳ Generating...' : '✨ Generate'}
                </button>
                <button className="btn-secondary" onClick={() => setShowAIModal(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PersonalityCard({
  personality, onUpdate, onRemove, canRemove
}: {
  personality: PersonalityDef
  onUpdate: (patch: Partial<PersonalityDef>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="glass" style={{ overflow: 'hidden', transition: 'all 0.2s' }}>
      {/* Header */}
      <div
        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Color swatch */}
        <div
          style={{
            width: 16, height: 16, borderRadius: '50%', background: personality.color,
            boxShadow: `0 0 8px ${personality.color}`, flexShrink: 0,
          }}
        />
        {/* Name */}
        <input
          className="input"
          value={personality.name}
          onChange={e => { e.stopPropagation(); onUpdate({ name: e.target.value }) }}
          onClick={e => e.stopPropagation()}
          style={{ flex: 1, fontWeight: 700, background: 'transparent', border: 'none', padding: '4px 0', fontSize: 15, cursor: 'text' }}
          placeholder="Personality name"
        />
        {/* Pct */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
            {personality.suggested_percentage}%
          </span>
          <input
            type="range" min={1} max={100}
            value={personality.suggested_percentage}
            onChange={e => { e.stopPropagation(); onUpdate({ suggested_percentage: Number(e.target.value) }) }}
            onClick={e => e.stopPropagation()}
            style={{ width: 80 }}
          />
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{expanded ? '▲' : '▼'}</span>
        {canRemove && (
          <button
            className="btn-icon"
            onClick={e => { e.stopPropagation(); onRemove() }}
            title="Remove"
            style={{ flexShrink: 0 }}
          >✕</button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Color picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label className="label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Color</label>
            <input
              type="color"
              value={personality.color}
              onChange={e => onUpdate({ color: e.target.value })}
              style={{ width: 40, height: 32, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {['#6366f1','#06b6d4','#ec4899','#f59e0b','#22c55e','#a855f7','#ef4444'].map(c => (
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

          {/* Description */}
          <div>
            <label className="label">Behavior Description (for AI prompts)</label>
            <textarea
              className="input"
              value={personality.description}
              onChange={e => onUpdate({ description: e.target.value })}
              placeholder="Describe how this agent type behaves..."
              rows={2}
              style={{ resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Trait sliders */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
            {(['credulity','influence','stubbornness','activity'] as const).map(trait => (
              <div key={trait}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="label" style={{ marginBottom: 0, color: TRAIT_COLORS[trait] }}>
                    {TRAIT_LABELS[trait]}
                  </label>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TRAIT_COLORS[trait] }}>
                    {personality[trait]}
                  </span>
                </div>
                <input
                  type="range" min={0} max={100}
                  value={personality[trait]}
                  onChange={e => onUpdate({ [trait]: Number(e.target.value) } as any)}
                  style={{ accentColor: TRAIT_COLORS[trait] }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
