import { useState, useCallback } from 'react'

export interface Provider {
  name: string
  status: 'connected' | 'error' | 'not_configured'
  error?: string
  last_validated?: string
}

export interface ProviderConfig {
  provider: string
  api_key?: string
  base_url?: string // for Ollama
  model_name?: string // for Ollama
}

export interface AIModel {
  name: string
  context_window?: number
  cost_per_1k?: number
  description?: string
}

export interface ActiveModels {
  world_generation_model: string
  agent_decision_model: string
}

interface UseProviderConfigReturn {
  // State
  providers: Record<string, Provider>
  loadingProviders: boolean
  errorProviders: string | null
  
  models: AIModel[]
  loadingModels: boolean
  errorModels: string | null
  
  activeModels: ActiveModels | null
  loadingActiveModels: boolean
  
  validating: boolean
  errorValidation: string | null
  
  // Actions
  fetchProviders: () => Promise<void>
  fetchModels: (provider: string) => Promise<void>
  fetchActiveModels: () => Promise<void>
  validateProvider: (config: ProviderConfig) => Promise<boolean>
  saveConfig: (config: ProviderConfig) => Promise<void>
  setActiveModels: (worldGenModel: string, agentDecisionModel: string) => Promise<void>
  deleteProvider: (provider: string) => Promise<void>
}

export function useProviderConfig(): UseProviderConfigReturn {
  const [providers, setProviders] = useState<Record<string, Provider>>({})
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [errorProviders, setErrorProviders] = useState<string | null>(null)

  const [models, setModels] = useState<AIModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [errorModels, setErrorModels] = useState<string | null>(null)

  const [activeModels, setActiveModels] = useState<ActiveModels | null>(null)
  const [loadingActiveModels, setLoadingActiveModels] = useState(false)

  const [validating, setValidating] = useState(false)
  const [errorValidation, setErrorValidation] = useState<string | null>(null)

  const fetchProviders = useCallback(async () => {
    setLoadingProviders(true)
    setErrorProviders(null)
    try {
      const res = await fetch('/api/config/providers')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProviders(data.providers || {})
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch providers'
      setErrorProviders(msg)
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  const fetchModels = useCallback(async (provider: string) => {
    setLoadingModels(true)
    setErrorModels(null)
    try {
      const res = await fetch(`/api/models/${provider}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setModels(data.models || [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch models'
      setErrorModels(msg)
    } finally {
      setLoadingModels(false)
    }
  }, [])

  const fetchActiveModels = useCallback(async () => {
    setLoadingActiveModels(true)
    try {
      const res = await fetch('/api/config/active-models')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setActiveModels(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch active models'
      console.error(msg)
    } finally {
      setLoadingActiveModels(false)
    }
  }, [])

  const validateProvider = useCallback(async (config: ProviderConfig): Promise<boolean> => {
    setValidating(true)
    setErrorValidation(null)
    try {
      const res = await fetch(`/api/config/validate/${config.provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Validation failed: HTTP ${res.status}`)
      }
      return true
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Validation failed'
      setErrorValidation(msg)
      return false
    } finally {
      setValidating(false)
    }
  }, [])

  const saveConfig = useCallback(async (config: ProviderConfig) => {
    setErrorProviders(null)
    try {
      const res = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Save failed: HTTP ${res.status}`)
      }
      // Refresh providers list after save
      await fetchProviders()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      setErrorProviders(msg)
      throw e
    }
  }, [fetchProviders])

  const setActiveModelsAction = useCallback(
    async (worldGenModel: string, agentDecisionModel: string) => {
      try {
        const res = await fetch('/api/config/set-active-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            world_generation_model: worldGenModel,
            agent_decision_model: agentDecisionModel,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail || `Save failed: HTTP ${res.status}`)
        }
        // Refresh active models
        await fetchActiveModels()
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Save failed'
        throw new Error(msg)
      }
    },
    [fetchActiveModels]
  )

  const deleteProvider = useCallback(async (provider: string) => {
    setErrorProviders(null)
    try {
      const res = await fetch(`/api/config/${provider}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Refresh providers list after delete
      await fetchProviders()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delete failed'
      setErrorProviders(msg)
      throw e
    }
  }, [fetchProviders])

  return {
    providers,
    loadingProviders,
    errorProviders,
    models,
    loadingModels,
    errorModels,
    activeModels,
    loadingActiveModels,
    validating,
    errorValidation,
    fetchProviders,
    fetchModels,
    fetchActiveModels,
    validateProvider,
    saveConfig,
    setActiveModels: setActiveModelsAction,
    deleteProvider,
  }
}
