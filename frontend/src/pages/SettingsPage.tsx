import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AppShell } from '../components/AppShell'
import { ProviderForm } from '../components/ProviderForm'
import { ModelSelector } from '../components/ModelSelector'
import { useProviderConfig, type ProviderConfig } from '../hooks/useProviderConfig'

const PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'Groq', 'OpenRouter', 'Ollama'] as const

type Tab = 'providers' | 'models'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('providers')
  const [selectedProvider, setSelectedProvider] = useState<string>('OpenAI')
  const [showForm, setShowForm] = useState(false)

  const [worldGenModel, setWorldGenModel] = useState('')
  const [agentDecisionModel, setAgentDecisionModel] = useState('')
  const [savingModels, setSavingModels] = useState(false)

  const {
    providers,
    loadingProviders,
    errorProviders,
    models,
    loadingModels,
    errorModels,
    activeModels,
    validating,
    errorValidation,
    fetchProviders,
    fetchModels,
    fetchActiveModels,
    validateProvider,
    saveConfig,
    setActiveModels: saveActiveModels,
    deleteProvider,
  } = useProviderConfig()

  useEffect(() => {
    fetchProviders()
    fetchActiveModels()
  }, [fetchProviders, fetchActiveModels])

  useEffect(() => {
    if (activeModels) {
      setWorldGenModel(activeModels.worldGeneration.modelId)
      setAgentDecisionModel(activeModels.agentDecision.modelId)
    }
  }, [activeModels])

  // Auto-load models when on the models tab (re-runs when providers finish loading)
  useEffect(() => {
    if (activeTab !== 'models') return
    const connectedProviders = Object.keys(providers).filter(p => getProviderStatus(p) === 'connected')
    if (connectedProviders.length === 0) return
    const providerToLoad = connectedProviders.includes(selectedProvider)
      ? selectedProvider
      : connectedProviders[0]
    setSelectedProvider(providerToLoad)
    fetchModels(providerToLoad)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, providers])

  const handleValidateAndSave = async (config: ProviderConfig) => {
    try {
      await saveConfig(config)
      const isValid = await validateProvider(config)
      await fetchProviders()
      if (isValid) {
        toast.success(`${config.provider} configured successfully`)
        setShowForm(false)
        setSelectedProvider(config.provider)
      } else {
        toast.error(`${config.provider} validation failed`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Configuration failed'
      toast.error(msg)
    }
  }

  const handleDeleteProvider = async (provider: string) => {
    if (!window.confirm(`Delete ${provider} configuration?`)) return
    try {
      await deleteProvider(provider)
      toast.success(`${provider} deleted`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delete failed'
      toast.error(msg)
    }
  }

  const handleSaveModels = async () => {
    if (!worldGenModel || !agentDecisionModel) {
      toast.error('Please select both models')
      return
    }
    setSavingModels(true)
    try {
      await saveActiveModels(selectedProvider, worldGenModel, agentDecisionModel)
      toast.success('Models updated successfully')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      toast.error(msg)
    } finally {
      setSavingModels(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return '--success'
      case 'error':
        return '--danger'
      default:
        return '--text-muted'
    }
  }

  const getProviderStatus = (provider: string) => {
    const info = providers[provider]
    if (!info) return 'not_configured'
    return info.status
  }

  return (
    <AppShell title="Settings">
      <div className="page-enter" style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
            LLM Provider Settings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
            Configure your AI providers and select models for world generation and agent decision-making.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          {(['providers', 'models'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                if (tab === 'models') {
                  const connected = Object.keys(providers).filter(p => getProviderStatus(p) === 'connected')
                  if (connected.length > 0) {
                    const p = connected.includes(selectedProvider) ? selectedProvider : connected[0]
                    setSelectedProvider(p)
                    fetchModels(p)
                  }
                }
              }}
              style={{
                padding: '12px 20px',
                background: activeTab === tab ? 'var(--accent)' : 'var(--bg-surface)',
                color: activeTab === tab ? 'white' : 'var(--text-secondary)',
                border: activeTab === tab ? 'none' : '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize',
              }}
              onMouseEnter={e => {
                if (activeTab !== tab) {
                  e.currentTarget.style.borderColor = 'var(--border-bright)'
                }
              }}
              onMouseLeave={e => {
                if (activeTab !== tab) {
                  e.currentTarget.style.borderColor = 'var(--border)'
                }
              }}
            >
              {tab === 'providers' ? '📋 Providers' : '🤖 Model Selection'}
            </button>
          ))}
        </div>

        <div className="glass" style={{ padding: 32, minHeight: 500 }}>
          {activeTab === 'providers' && (
            <div>
              {errorProviders && (
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8,
                    color: '#ef4444',
                    fontSize: 13,
                    marginBottom: 20,
                  }}
                >
                  {errorProviders}
                </div>
              )}

              {!showForm ? (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add New Provider</h2>

                  <div style={{ marginBottom: 24 }}>
                    <label className="label">Select Provider</label>
                    <select
                      value={selectedProvider}
                      onChange={e => setSelectedProvider(e.currentTarget.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      {PROVIDERS.map(p => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button onClick={() => setShowForm(true)} className="btn-primary">
                    Configure {selectedProvider}
                  </button>
                </div>
              ) : (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
                    {selectedProvider} Configuration
                  </h2>
                  <ProviderForm
                    provider={selectedProvider}
                    onSubmit={handleValidateAndSave}
                    onCancel={() => setShowForm(false)}
                    loading={validating}
                    error={errorValidation}
                  />
                </div>
              )}

              <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Configured Providers</h2>

                {loadingProviders ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading providers...
                  </div>
                ) : Object.keys(providers).length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
                    No providers configured yet
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {Object.entries(providers).map(([name, info]) => (
                      <div
                        key={name}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '16px 20px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--bg-card-hover)'
                          e.currentTarget.style.borderColor = 'var(--border-bright)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--bg-surface)'
                          e.currentTarget.style.borderColor = 'var(--border)'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                            {name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span
                              style={{
                                color: `var(${getStatusColor(info.status)})`,
                                fontWeight: 600,
                              }}
                            >
                              {info.status === 'connected' ? '✓ Connected' : info.status === 'error' ? '✗ Error' : '◯ Not Configured'}
                            </span>
                            {info.last_validated && (
                              <span>Last validated: {new Date(info.last_validated).toLocaleDateString()}</span>
                            )}
                          </div>
                          {info.error && (
                            <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>
                              Error: {info.error}
                            </div>
                          )}
                        </div>
                        {info.status !== 'not_configured' && (
                          <button
                            onClick={() => handleDeleteProvider(name)}
                            style={{
                              padding: '8px 16px',
                              background: 'rgba(239,68,68,0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239,68,68,0.3)',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: 600,
                              transition: 'all 0.15s',
                              whiteSpace: 'nowrap',
                              marginLeft: 16,
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(239,68,68,0.2)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'models' && (
              <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Select Models</h2>

              {errorModels && (
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8,
                    color: '#ef4444',
                    fontSize: 13,
                    marginBottom: 20,
                  }}
                >
                  {errorModels}
                </div>
              )}

              {Object.keys(providers).filter(p => getProviderStatus(p) === 'connected').length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 20px', background: 'var(--bg-surface)', borderRadius: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No providers connected yet</div>
                  <div style={{ fontSize: 13 }}>Configure a provider in the "Providers" tab first</div>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <label className="label">Choose Provider</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={
                          Object.keys(providers).filter(p => getProviderStatus(p) === 'connected').includes(selectedProvider)
                            ? selectedProvider
                            : Object.keys(providers).filter(p => getProviderStatus(p) === 'connected')[0] ?? ''
                        }
                        onChange={e => {
                          setSelectedProvider(e.currentTarget.value)
                          fetchModels(e.currentTarget.value)
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          fontSize: 14,
                          cursor: 'pointer',
                        }}
                      >
                        {Object.keys(providers)
                          .filter(p => getProviderStatus(p) === 'connected')
                          .map(p => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => {
                          const connected = Object.keys(providers).filter(p => getProviderStatus(p) === 'connected')
                          const p = connected.includes(selectedProvider) ? selectedProvider : connected[0]
                          if (p) fetchModels(p)
                        }}
                        disabled={loadingModels}
                        style={{
                          padding: '10px 16px',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          fontSize: 13,
                          cursor: loadingModels ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        title="Reload models"
                      >
                        {loadingModels ? '...' : '⟳ Load'}
                      </button>
                    </div>
                  </div>

                  {loadingModels ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
                      Loading models...
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 32 }}>
                        <ModelSelector
                          label="World Generation Model"
                          models={models}
                          selectedModel={worldGenModel}
                          onSelect={setWorldGenModel}
                          disabled={models.length === 0}
                          loading={loadingModels}
                        />
                      </div>

                      <div style={{ marginBottom: 32 }}>
                        <ModelSelector
                          label="Agent Decision Making Model"
                          models={models}
                          selectedModel={agentDecisionModel}
                          onSelect={setAgentDecisionModel}
                          disabled={models.length === 0}
                          loading={loadingModels}
                        />
                      </div>

                      <button onClick={handleSaveModels} className="btn-primary" disabled={savingModels || !worldGenModel || !agentDecisionModel}>
                        {savingModels ? '...' : 'Save Model Selection'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
