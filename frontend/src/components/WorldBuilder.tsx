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
    const trimmedTopic = topic.trim()

    if (trimmedTopic.length === 0) {
      setError('Please describe your scenario')
      return
    }
    if (trimmedTopic.length < 5) {
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
        body: JSON.stringify({ topic: trimmedTopic }),
      })

      if (!res.ok) {
        let errorMsg = 'Generation failed'
        try {
          const err = await res.json()
          errorMsg = err.error || errorMsg
          if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota') || res.status === 429) {
            errorMsg = 'API quota exhausted. Please wait a few minutes before trying again.'
          }
        } catch {
          errorMsg = `Server error (${res.status}). Please try again later.`
        }
        throw new Error(errorMsg)
      }

      const config: WorldConfig = await res.json()
      setPreview(config)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to generate world config'
      setError(message)
    } finally {
      setGenerating(false)
    }
  }

  const handleLaunch = () => {
    if (preview) onGenerateConfig(preview)
  }

  return (
    <div className="fade-in">
      {!preview ? (
        <>
          {/* Section label */}
          <div style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 9,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{ width: 16, height: 1, background: 'var(--border-bright)' }} />
            Step 01 — Describe your scenario
          </div>

          {/* Textarea */}
          <div style={{ marginBottom: 20 }}>
            <label className="label">Your scenario</label>
            <textarea
              className="input"
              value={topic}
              onChange={e => {
                setTopic(e.currentTarget.value)
                if (error) setError('')
              }}
              placeholder="e.g., 'A tech community debating AI safety regulations, with researchers, entrepreneurs, and skeptics taking opposing sides'"
              rows={4}
              style={{ resize: 'vertical', lineHeight: 1.7, fontSize: 14, fontFamily: 'Syne, sans-serif' }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            />
            {error && (
              <p style={{
                fontFamily: 'DM Mono, monospace',
                color: 'var(--error)',
                fontSize: 11,
                marginTop: 6,
                letterSpacing: '0.02em',
              }}>
                ⚠ {error}
              </p>
            )}
          </div>

          {/* Example prompts */}
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 9,
              color: 'var(--text-muted)',
              marginBottom: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              Example scenarios
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {EXAMPLE_TOPICS.map(ex => (
                <button
                  key={ex}
                  onClick={() => setTopic(ex)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontFamily: 'Syne, sans-serif',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.14s, color 0.14s, background 0.14s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget
                    el.style.borderColor = 'var(--border-bright)'
                    el.style.color = 'var(--text-primary)'
                    el.style.background = 'rgba(232,160,32,0.04)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget
                    el.style.borderColor = 'var(--border)'
                    el.style.color = 'var(--text-muted)'
                    el.style.background = 'var(--bg-surface)'
                  }}
                >
                  <span style={{ color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 10, flexShrink: 0 }}>→</span>
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              className="btn-primary glow-pulse"
              onClick={handleGenerate}
              disabled={generating || topic.trim().length < 5}
              style={{ padding: '12px 32px', fontSize: 12 }}
            >
              {generating ? (
                <span className="data-stream">Generating world...</span>
              ) : (
                '✦ Generate Config'
              )}
            </button>
            <button
              className="btn-secondary"
              onClick={onSkip}
              style={{ padding: '12px 20px', fontSize: 11 }}
            >
              Classic setup →
            </button>
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 10,
              color: 'var(--text-muted)',
              marginLeft: 4,
            }}>
              ⌘↵ to generate
            </span>
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
      {/* Generated world header */}
      <div style={{
        padding: '20px 24px',
        background: 'rgba(232, 160, 32, 0.05)',
        borderRadius: 4,
        border: '1px solid var(--border-bright)',
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Corner bracket top-left */}
        <div style={{
          position: 'absolute',
          top: -1, left: -1,
          width: 14, height: 14,
          borderTop: '2px solid var(--accent)',
          borderLeft: '2px solid var(--accent)',
          borderRadius: '3px 0 0 0',
        }} />
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: 9,
          color: 'var(--accent)',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
          AI-Generated World
        </div>
        <h3 style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: 20,
          fontWeight: 800,
          marginBottom: 8,
          letterSpacing: '-0.01em',
        }}>
          {config.topic}
        </h3>
        <p style={{
          fontFamily: 'Syne, sans-serif',
          color: 'var(--text-secondary)',
          fontSize: 13,
          lineHeight: 1.7,
        }}>
          {config.scenario_description}
        </p>
      </div>

      {/* Key concepts */}
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 10 }}>Key concepts</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {config.key_concepts.map(c => (
            <span key={c} style={{
              padding: '3px 10px',
              borderRadius: 2,
              fontSize: 11,
              fontFamily: 'DM Mono, monospace',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-bright)',
              color: 'var(--text-secondary)',
              letterSpacing: '0.03em',
            }}>
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Personality archetypes */}
      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 10 }}>
          Generated personalities ({config.personality_archetypes.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {config.personality_archetypes.map((p: PersonalityDef) => (
            <div key={p.name} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '9px 14px',
              background: 'var(--bg-surface)',
              borderRadius: 3,
              border: '1px solid var(--border)',
              transition: 'border-color 0.14s',
            }}>
              <div style={{
                width: 8, height: 8,
                borderRadius: '50%',
                background: p.color,
                flexShrink: 0,
                boxShadow: `0 0 6px ${p.color}70`,
              }} />
              <div style={{ flex: 1 }}>
                <span style={{
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: 13,
                }}>
                  {p.name}
                </span>
                <span style={{
                  fontFamily: 'DM Mono, monospace',
                  color: 'var(--text-muted)',
                  fontSize: 10,
                  marginLeft: 8,
                }}>
                  {p.suggested_percentage}%
                </span>
                <div style={{
                  fontFamily: 'Syne, sans-serif',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  marginTop: 2,
                  lineHeight: 1.5,
                }}>
                  {p.description}
                </div>
              </div>
              <div style={{
                display: 'flex',
                gap: 10,
                fontFamily: 'DM Mono, monospace',
                fontSize: 10,
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}>
                <span title="Credulity" style={{ color: 'var(--accent3)' }}>C:{p.credulity}</span>
                <span title="Influence" style={{ color: 'var(--accent)' }}>I:{p.influence}</span>
                <span title="Stubbornness" style={{ color: 'var(--accent2)' }}>S:{p.stubbornness}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested config summary */}
      <div style={{
        padding: '14px 18px',
        background: 'var(--bg-surface)',
        borderRadius: 3,
        border: '1px solid var(--border)',
        marginBottom: 28,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px 20px',
      }}>
        {[
          { label: 'Theme', value: config.suggested_config.theme },
          { label: 'Agents', value: String(config.agent_count) },
          { label: 'Topology', value: config.suggested_config.topology.replace('_', ' ') },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 9,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 3,
            }}>
              {label}
            </div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: 13,
              textTransform: 'capitalize',
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-primary glow-pulse" onClick={onLaunch} style={{ padding: '12px 36px', fontSize: 12 }}>
          Launch simulation →
        </button>
        <button className="btn-secondary" onClick={onEdit} style={{ padding: '12px 20px', fontSize: 11 }}>
          ← Edit topic
        </button>
      </div>
    </div>
  )
}
