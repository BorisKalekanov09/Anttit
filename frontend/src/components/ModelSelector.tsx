import { useState, useRef } from 'react'
import type { AIModel } from '../hooks/useProviderConfig'

interface ModelSelectorProps {
  models: AIModel[]
  selectedModel: string
  onSelect: (model: string) => void
  label: string
  disabled?: boolean
  loading?: boolean
}

export function ModelSelector({ models, selectedModel, onSelect, label, disabled = false, loading = false }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedModelObj = models.find(m => m.id === selectedModel)

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <label className="label" style={{ marginBottom: 8 }}>
        {label}
      </label>

      <div
        style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
        }}
      >
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled || loading}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'transparent',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: 10,
            cursor: disabled ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: disabled ? 0.5 : 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => !disabled && (e.currentTarget.style.background = 'var(--bg-card)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            {selectedModelObj?.name || 'Select a model...'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>▼</span>
        </button>

        {isOpen && !disabled && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-bright)',
              borderTop: 'none',
              borderRadius: '0 0 10px 10px',
              maxHeight: 240,
              overflowY: 'auto',
              zIndex: 100,
            }}
          >
            {models.length === 0 ? (
              <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13 }}>
                No models available
              </div>
            ) : (
              models.map(model => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onSelect(model.id)
                    setIsOpen(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: selectedModel === model.id ? 'rgba(124,109,250,0.15)' : 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = selectedModel === model.id ? 'rgba(124,109,250,0.15)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{model.name}</div>
                      {model.context_window && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                          Context: {model.context_window.toLocaleString()} tokens
                        </div>
                      )}
                    </div>
                    {model.cost_per_1k && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        ${model.cost_per_1k}/1k
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selectedModelObj && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(124,109,250,0.08)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          {selectedModelObj.description || 'Selected model'}
        </div>
      )}
    </div>
  )
}
