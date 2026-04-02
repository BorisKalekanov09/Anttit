import { useState, useCallback, useRef, useEffect } from 'react'
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

const TRAITS = ['credulity', 'influence', 'stubbornness', 'activity'] as const

const DEFAULT_COLORS = ['#6366f1','#06b6d4','#ec4899','#f59e0b','#22c55e','#a855f7','#e74c3c','#2ecc71']

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

  const movePersonality = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= personalities.length) return
    const updated = [...personalities]
    const temp = updated[idx]
    updated[idx] = updated[newIdx]
    updated[newIdx] = temp
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
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Gemini generation failed'
      toast.error(errMsg)
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
            index={idx}
            totalCount={personalities.length}
            onUpdate={patch => updatePersonality(idx, patch)}
            onRemove={() => removePersonality(idx)}
            onMove={dir => movePersonality(idx, dir)}
            canRemove={personalities.length > 1}
          />
        ))}
      </div>

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
                    <RadarChart personality={p} size={50} />
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

function RadarChart({ personality, size = 80 }: { personality: PersonalityDef; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const maxR = size / 2 - 4

    ctx.clearRect(0, 0, size, size)

    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    for (let ring = 1; ring <= 3; ring++) {
      const r = (maxR / 3) * ring
      ctx.beginPath()
      for (let i = 0; i < TRAITS.length; i++) {
        const angle = (Math.PI * 2 * i) / TRAITS.length - Math.PI / 2
        const x = cx + Math.cos(angle) * r
        const y = cy + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    for (let i = 0; i < TRAITS.length; i++) {
      const angle = (Math.PI * 2 * i) / TRAITS.length - Math.PI / 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR)
      ctx.stroke()
    }

    const values = TRAITS.map(t => personality[t] / 100)
    ctx.beginPath()
    for (let i = 0; i < TRAITS.length; i++) {
      const angle = (Math.PI * 2 * i) / TRAITS.length - Math.PI / 2
      const r = values[i] * maxR
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = personality.color + '40'
    ctx.fill()
    ctx.strokeStyle = personality.color
    ctx.lineWidth = 2
    ctx.stroke()

    for (let i = 0; i < TRAITS.length; i++) {
      const angle = (Math.PI * 2 * i) / TRAITS.length - Math.PI / 2
      const r = values[i] * maxR
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fillStyle = personality.color
      ctx.fill()
    }
  }, [personality, size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  )
}

function PersonalityCard({
  personality, index, totalCount, onUpdate, onRemove, onMove, canRemove
}: {
  personality: PersonalityDef
  index: number
  totalCount: number
  onUpdate: (patch: Partial<PersonalityDef>) => void
  onRemove: () => void
  onMove: (dir: 'up' | 'down') => void
  canRemove: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="glass" style={{ overflow: 'hidden', transition: 'all 0.2s' }}>
      <div
        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <RadarChart personality={personality} size={80} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            className="input"
            value={personality.name}
            onChange={e => { e.stopPropagation(); onUpdate({ name: e.target.value }) }}
            onClick={e => e.stopPropagation()}
            style={{ fontWeight: 700, background: 'transparent', border: 'none', padding: '4px 0', fontSize: 15, cursor: 'text', width: '100%' }}
            placeholder="Personality name"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
              {personality.suggested_percentage}%
            </span>
            <input
              type="range" min={1} max={100}
              value={personality.suggested_percentage}
              onChange={e => { e.stopPropagation(); onUpdate({ suggested_percentage: Number(e.target.value) }) }}
              onClick={e => e.stopPropagation()}
              style={{ flex: 1, maxWidth: 100 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            className="btn-icon"
            onClick={e => { e.stopPropagation(); onMove('up') }}
            disabled={index === 0}
            style={{ width: 28, height: 28, fontSize: 12, opacity: index === 0 ? 0.3 : 1 }}
            title="Move up"
          >↑</button>
          <button
            className="btn-icon"
            onClick={e => { e.stopPropagation(); onMove('down') }}
            disabled={index === totalCount - 1}
            style={{ width: 28, height: 28, fontSize: 12, opacity: index === totalCount - 1 ? 0.3 : 1 }}
            title="Move down"
          >↓</button>
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

      {expanded && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
            {TRAITS.map(trait => (
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
                  onChange={e => onUpdate({ [trait]: Number(e.target.value) })}
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
