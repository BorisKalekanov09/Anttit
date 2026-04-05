import { useState } from 'react'
import type { ProviderConfig } from '../hooks/useProviderConfig'

interface ProviderFormProps {
  provider: string
  onSubmit: (config: ProviderConfig) => void
  onCancel: () => void
  loading?: boolean
  error?: string | null
}

export function ProviderForm({ provider, onSubmit, onCancel, loading = false, error }: ProviderFormProps) {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelName, setModelName] = useState('')

  const isOllama = provider === 'Ollama'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey && !isOllama) {
      alert('API key is required')
      return
    }
    if (isOllama && (!baseUrl || !modelName)) {
      alert('Base URL and model name are required for Ollama')
      return
    }

    const config: ProviderConfig = {
      provider,
      api_key: apiKey,
      base_url: isOllama ? baseUrl : undefined,
      model_name: isOllama ? modelName : undefined,
    }
    onSubmit(config)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            color: '#ef4444',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      {!isOllama && (
        <div>
          <label className="label">API Key</label>
          <input
            type="password"
            className="input"
            placeholder={`Enter ${provider} API key`}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            disabled={loading}
          />
        </div>
      )}

      {isOllama && (
        <>
          <div>
            <label className="label">Base URL</label>
            <input
              type="text"
              className="input"
              placeholder="http://localhost:11434"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label className="label">Model Name</label>
            <input
              type="text"
              className="input"
              placeholder="llama2"
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              disabled={loading}
            />
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '...' : 'Validate'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      </div>
    </form>
  )
}
