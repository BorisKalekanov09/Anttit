import { useState, useCallback } from 'react'

export interface Provider {
  name: string
  status: 'connected' | 'error' | 'not_configured'
  error?: string
  last_validated?: string
}

export interface ProviderConfig {
  provider: string
  apiKey?: string
  baseUrl?: string // for Ollama
  modelName?: string // for Ollama
}

export interface AIModel {
  id: string
  name: string
  context_window?: number
  cost_per_1k?: number
  description?: string
}

export interface ActiveModels {
  worldGeneration: { provider: string; modelId: string }
  agentDecision: { provider: string; modelId: string }
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
  setActiveModels: (provider: string, worldGenModel: string, agentDecisionModel: string) => Promise<void>
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
      const res = await fetch(`/api/config/models/${provider.toLowerCase()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Map backend ModelInfo shape to frontend AIModel shape
      const mapped: AIModel[] = (data.models || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        context_window: m.contextWindow,
        cost_per_1k: m.costPer1kTokens?.input,
      }))
      setModels(mapped)
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
        const errorMsg = err.error || `Validation failed: HTTP ${res.status}`
        setErrorValidation(errorMsg)
        console.error(`Validation failed for ${config.provider}:`, errorMsg)
        return false
      }
      return true
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Validation failed'
      setErrorValidation(msg)
      console.error(`Validation error for ${config.provider}:`, msg)
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
        throw new Error(err.error || `Save failed: HTTP ${res.status}`)
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
    async (provider: string, worldGenModel: string, agentDecisionModel: string) => {
      const providerLower = provider.toLowerCase()
      try {
        const res = await fetch('/api/config/set-active-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worldGeneration: { provider: providerLower, modelId: worldGenModel },
            agentDecision: { provider: providerLower, modelId: agentDecisionModel },
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
