import { useState } from 'react'
import type { WorldConfig, PersonalityDef } from '../types/simulation'

interface WorldBuilderProps {
  onGenerateConfig: (config: WorldConfig) => void
  onSkip: () => void
}

const EXAMPLE_TOPICS = [
  'AI safety debate in a tech startup community',
  'Vaccine hesitancy spreading through a small town',
  'Climate policy debate between activists, scientists, and industry leaders',
  'Misinformation about a local election candidate going viral',
]

export default function WorldBuilder({ onGenerateConfig, onSkip }: WorldBuilderProps) {
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState<WorldConfig | null>(null)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (topic.trim().length < 5) {
      setError('Please describe your scenario in at least a few words')
      return
    }
    setError('')
    setGenerating(true)
    setPreview(null)
    try {
      const res = await fetch('/api/world-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Generation failed')
      }
      const config: WorldConfig = await res.json()
      setPreview(config)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate world config')
    } finally {
      setGenerating(false)
    }
  }

  const handleLaunch = () => {
    if (preview) onGenerateConfig(preview)
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
          Describe your world
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
          Write a topic or scenario in plain language — Gemini will generate the entire simulation config for you.
        </p>
      </div>

      {!preview ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <label className="label">Your scenario</label>
            <textarea
              className="input"
              value={topic}
              onChange={e => { setTopic(e.target.value); setError('') }}
              placeholder="e.g., 'A tech community debating AI safety regulations, with researchers, entrepreneurs, and skeptics taking opposing sides'"
              rows={4}
              style={{ resize: 'vertical', lineHeight: 1.7, fontSize: 15 }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            />
            {error && (
              <p style={{ color: 'var(--error, #ef4444)', fontSize: 13, marginTop: 6 }}>{error}</p>
            )}
          </div>

          {/* Example prompts */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Examples
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {EXAMPLE_TOPICS.map(ex => (
                <button
                  key={ex}
                  onClick={() => setTopic(ex)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              className="btn-primary glow-pulse"
              onClick={handleGenerate}
              disabled={generating || topic.trim().length < 5}
              style={{ padding: '12px 32px', fontSize: 15 }}
            >
              {generating ? '⏳ Generating world...' : '✦ Generate Config'}
            </button>
            <button
              className="btn-secondary"
              onClick={onSkip}
              style={{ padding: '12px 20px', fontSize: 14 }}
            >
              Use classic setup →
            </button>
          </div>
        </>
      ) : (
        <WorldPreview config={preview} onLaunch={handleLaunch} onEdit={() => setPreview(null)} />
      )}
    </div>
  )
}

function WorldPreview({ config, onLaunch, onEdit }: { config: WorldConfig; onLaunch: () => void; onEdit: () => void }) {
  return (
    <div className="fade-in">
      {/* Title */}
      <div style={{
        padding: '20px 24px',
        background: 'rgba(124,109,250,0.08)',
        borderRadius: 12,
        border: '1px solid var(--accent-glow)',
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          AI-Generated World
        </div>
        <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{config.topic}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
          {config.scenario_description}
        </p>
      </div>

      {/* Key concepts */}
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 10 }}>Key concepts</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {config.key_concepts.map(c => (
            <span key={c} style={{
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 13,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-bright)',
              color: 'var(--text-secondary)',
            }}>
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Personalities */}
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 10 }}>
          Generated personalities ({config.personality_archetypes.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {config.personality_archetypes.map((p: PersonalityDef) => (
            <div key={p.name} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              background: 'var(--bg-surface)',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: p.color, flexShrink: 0,
                boxShadow: `0 0 6px ${p.color}80`,
              }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
                  {p.suggested_percentage}%
                </span>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
                  {p.description}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                <span title="Credulity">C:{p.credulity}</span>
                <span title="Influence">I:{p.influence}</span>
                <span title="Stubbornness">S:{p.stubbornness}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested config */}
      <div style={{
        padding: '16px 20px',
        background: 'var(--bg-surface)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        marginBottom: 28,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 24px', fontSize: 13 }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Theme:</span>{' '}
            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{config.suggested_config.theme}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Agents:</span>{' '}
            <span style={{ fontWeight: 600 }}>{config.agent_count}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Topology:</span>{' '}
            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{config.suggested_config.topology.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-primary glow-pulse" onClick={onLaunch} style={{ padding: '12px 32px', fontSize: 15 }}>
          Use this config →
        </button>
        <button className="btn-secondary" onClick={onEdit} style={{ padding: '12px 20px', fontSize: 14 }}>
          ← Edit topic
        </button>
      </div>
    </div>
  )
}
