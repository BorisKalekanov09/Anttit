import { useEffect, useRef, useState, useCallback } from 'react'
import type { SimMessage, SimState, InitMessage, TickMessage, AgentProfile, AnalysisMessage, DirectMessage, AgentGroup, GroupMessage, ConversationLog, CausalChain, Relationship } from '../types/simulation'

// Re-export for consumers
export type { DirectMessage, AgentGroup, GroupMessage }

const WS_BASE = import.meta.env.VITE_WS_BASE ?? `ws://${window.location.hostname}:3003`

const MAX_RETRIES = 5

interface AgentProfileCache {
  data: AgentProfile
  timestamp: number
}

interface AgentTimelineCache {
  data: { agentId: string; timeline: any[]; pagination: { offset: number; limit: number; total: number } }
  offset: number
  limit: number
  timestamp: number
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export function useSimulation(simId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null)
  const agentProfileCacheRef = useRef<Map<string, AgentProfileCache>>(new Map())
  const agentTimelineCacheRef = useRef<Map<string, AgentTimelineCache>>(new Map())
  const apiCallCountRef = useRef(0)
  const totalTokensUsedRef = useRef(0)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // E: O(1) relationship deduplication via Map keyed by "sourceId:targetId"
  const relMapRef = useRef<Map<string, Relationship>>(new Map())

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  const [state, setState] = useState<SimState>({
    simId: simId ?? '',
    tick: 0,
    running: false,
    paused: false,
    initData: null,
    latestTick: null,
    events: [],
    history: [],
    analysisReport: null,
    discussionFeed: [],
    relationships: [],
    apiCallCount: apiCallCountRef.current,
    totalTokensUsed: totalTokensUsedRef.current,
    groups: [],
    directMessages: [],
    conversations: [],
    latestAdvancedMetrics: null,
  })

  const trackApiCall = useCallback((tokensUsed: number = 0) => {
    apiCallCountRef.current += 1
    totalTokensUsedRef.current += tokensUsed
    setState(s => ({
      ...s,
      apiCallCount: apiCallCountRef.current,
      totalTokensUsed: totalTokensUsedRef.current,
    }))
  }, [])

  useEffect(() => {
    if (!simId) return

    let destroyed = false
    retryCountRef.current = 0

    const connect = () => {
      // Clear relationship map on each (re)connect so stale rels don't persist
      relMapRef.current.clear()

      const ws = new WebSocket(`${WS_BASE}/ws/${simId}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (destroyed) { ws.close(); return }
        retryCountRef.current = 0
        setConnectionStatus('connected')
        setState(s => ({ ...s, running: true }))
      }

      ws.onmessage = (e) => {
        if (destroyed) return
        const msg: SimMessage = JSON.parse(e.data)
        if (msg.type === 'init') {
          setState(s => ({ ...s, initData: msg as InitMessage }))
        } else if (msg.type === 'tick') {
          const tick = msg as TickMessage
          setState(s => ({
            ...s,
            tick: tick.tick,
            latestTick: tick,
            events: [...tick.events, ...s.events].slice(0, 200),
            history: [...s.history, tick].slice(-2000),
            latestAdvancedMetrics: tick.advancedMetrics ?? s.latestAdvancedMetrics,
          }))
        } else if (msg.type === 'analysis') {
          const analysisMsg = msg as AnalysisMessage
          setState(s => ({
            ...s,
            running: false,
            analysisReport: analysisMsg.report || null,
          }))
        } else if (msg.type === 'feed_update') {
          setState(s => ({
            ...s,
            discussionFeed: msg.posts || s.discussionFeed,
          }))
        } else if (msg.type === 'api_call') {
          setState(s => ({
            ...s,
            apiCallCount: (msg as any).count || s.apiCallCount,
            totalTokensUsed: (msg as any).tokensUsed || s.totalTokensUsed,
          }))
        } else if (msg.type === 'relationship_update') {
          // E: O(1) dedup via Map — no filter() scan
          const key = `${msg.data.sourceAgentId}:${msg.data.targetAgentId}`
          relMapRef.current.set(key, msg.data)
          const relationships = Array.from(relMapRef.current.values())
          setState(s => ({ ...s, relationships }))
        } else if (msg.type === 'dm_update') {
          setState(s => ({
            ...s,
            directMessages: [...s.directMessages, msg.dm].slice(-500),
          }))
        } else if (msg.type === 'group_update') {
          setState(s => ({ ...s, groups: msg.groups }))
        } else if (msg.type === 'conversation_update') {
          setState(s => ({
            ...s,
            conversations: [...s.conversations, msg.conversation].slice(-200),
          }))
        }
      }

      ws.onclose = () => {
        if (destroyed) return
        setState(s => ({ ...s, running: false }))

        if (retryCountRef.current < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000)
          retryCountRef.current++
          setConnectionStatus('reconnecting')
          retryTimerRef.current = setTimeout(() => {
            if (!destroyed) connect()
          }, delay)
        } else {
          setConnectionStatus('disconnected')
        }
      }

      ws.onerror = () => {
        // onclose fires right after onerror, reconnect logic is there
      }
    }

    connect()

    return () => {
      destroyed = true
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      wsRef.current?.close()
    }
  }, [simId])

  const control = useCallback(async (action: string, tick_rate?: number) => {
    await fetch(`/api/simulations/${simId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, tick_rate }),
    })
    if (action === 'pause') setState(s => ({ ...s, paused: true }))
    if (action === 'resume') setState(s => ({ ...s, paused: false }))
  }, [simId])

  const inject = useCallback(async (event_type: string, payload: object = {}) => {
    await fetch(`/api/simulations/${simId}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, payload }),
    })
    trackApiCall()
  }, [simId, trackApiCall])

  const snapshot = useCallback(async () => {
    const res = await fetch(`/api/simulations/${simId}/snapshot`)
    trackApiCall()
    return await res.json()
  }, [simId, trackApiCall])

  const likePost = useCallback(async (postId: string) => {
    const res = await fetch(`/api/simulations/${simId}/feed/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    trackApiCall()
    return await res.json()
  }, [simId, trackApiCall])

  const commentPost = useCallback(async (postId: string, message: string) => {
    const res = await fetch(`/api/simulations/${simId}/feed/posts/${postId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    trackApiCall()
    return await res.json()
  }, [simId, trackApiCall])

  const fetchAgentProfile = useCallback(async (agentId: string): Promise<AgentProfile | null> => {
    try {
      const cached = agentProfileCacheRef.current.get(agentId)
      if (cached) {
        return cached.data
      }

      const res = await fetch(`/api/simulations/${simId}/agents/${agentId}`)
      if (!res.ok) return null

      const profile: AgentProfile = await res.json()
      agentProfileCacheRef.current.set(agentId, {
        data: profile,
        timestamp: Date.now(),
      })
      trackApiCall()

      return profile
    } catch (error) {
      console.error('Failed to fetch agent profile:', error)
      return null
    }
  }, [simId, trackApiCall])

  const fetchAgentTimeline = useCallback(async (agentId: string, offset = 0, limit = 20) => {
    try {
      const cached = agentTimelineCacheRef.current.get(agentId)
      if (cached && cached.offset === offset && cached.limit === limit) {
        return cached.data
      }

      const res = await fetch(`/api/simulations/${simId}/agents/${agentId}/timeline?offset=${offset}&limit=${limit}`)
      if (!res.ok) return null

      const timelineData = await res.json()
      agentTimelineCacheRef.current.set(agentId, {
        data: timelineData,
        offset,
        limit,
        timestamp: Date.now(),
      })
      trackApiCall()

      return timelineData
    } catch (error) {
      console.error('Failed to fetch agent timeline:', error)
      return null
    }
  }, [simId, trackApiCall])

  const likeAgentProfile = useCallback(async (agentId: string): Promise<AgentProfile | null> => {
    try {
      const res = await fetch(`/api/simulations/${simId}/agents/${agentId}/profile-like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.status === 409) return null
      if (!res.ok) return null

      trackApiCall()

      const updatedProfile: AgentProfile = await res.json()
      agentProfileCacheRef.current.set(agentId, {
        data: updatedProfile,
        timestamp: Date.now(),
      })

      return updatedProfile
    } catch (error) {
      console.error('Failed to like agent profile:', error)
      return null
    }
  }, [simId, trackApiCall])

  const clearAgentCache = useCallback((agentId?: string) => {
    if (agentId) {
      agentProfileCacheRef.current.delete(agentId)
      agentTimelineCacheRef.current.delete(agentId)
    } else {
      agentProfileCacheRef.current.clear()
      agentTimelineCacheRef.current.clear()
    }
  }, [])

  const fetchDMConversation = useCallback(async (agentA: string, agentB: string): Promise<DirectMessage[]> => {
    try {
      const res = await fetch(`/api/simulations/${simId}/dms/conversation/${agentA}/${agentB}`)
      if (!res.ok) return []
      const data = await res.json()
      return data.dms ?? []
    } catch {
      return []
    }
  }, [simId])

  const sendDM = useCallback(async (fromAgentId: string, toAgentId: string, content: string): Promise<DirectMessage | null> => {
    try {
      const res = await fetch(`/api/simulations/${simId}/dms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAgentId, toAgentId, content }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [simId])

  const fetchGroups = useCallback(async (): Promise<AgentGroup[]> => {
    try {
      const res = await fetch(`/api/simulations/${simId}/groups`)
      if (!res.ok) return []
      const data = await res.json()
      return data.groups ?? []
    } catch {
      return []
    }
  }, [simId])

  const fetchGroupMessages = useCallback(async (groupId: string): Promise<GroupMessage[]> => {
    try {
      const res = await fetch(`/api/simulations/${simId}/groups/${groupId}/messages`)
      if (!res.ok) return []
      const data = await res.json()
      return data.messages ?? []
    } catch {
      return []
    }
  }, [simId])

  const sendGroupMessage = useCallback(async (groupId: string, agentId: string, content: string): Promise<GroupMessage | null> => {
    try {
      const res = await fetch(`/api/simulations/${simId}/groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, content }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [simId])

  const joinGroup = useCallback(async (groupId: string, agentId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/simulations/${simId}/groups/${groupId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      })
      return res.ok
    } catch {
      return false
    }
  }, [simId])

  const leaveGroup = useCallback(async (groupId: string, agentId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/simulations/${simId}/groups/${groupId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      })
      return res.ok
    } catch {
      return false
    }
  }, [simId])

  const fetchCausalChain = useCallback(async (agentId: string): Promise<CausalChain | null> => {
    try {
      const res = await fetch(`/api/simulations/${simId}/agents/${agentId}/causal-chain`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [simId])

  const fetchConversations = useCallback(async (agentAId?: string, agentBId?: string): Promise<ConversationLog[]> => {
    try {
      const url = agentAId && agentBId
        ? `/api/simulations/${simId}/conversations/${agentAId}/${agentBId}`
        : `/api/simulations/${simId}/conversations`
      const res = await fetch(url)
      if (!res.ok) return []
      const data = await res.json()
      return data.conversations ?? []
    } catch {
      return []
    }
  }, [simId])

  const assignExperimentGroups = useCallback(async (treatmentFraction: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/simulations/${simId}/experiment/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treatmentFraction }),
      })
      return res.ok
    } catch {
      return false
    }
  }, [simId])

  const injectTargeted = useCallback(async (group: 'control' | 'treatment', fraction: number, state?: string): Promise<void> => {
    await fetch(`/api/simulations/${simId}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'targeted_injection', payload: { group, fraction, state } }),
    })
  }, [simId])

  return {
    state,
    connectionStatus,
    control,
    inject,
    snapshot,
    likePost,
    commentPost,
    fetchAgentProfile,
    fetchAgentTimeline,
    likeAgentProfile,
    clearAgentCache,
    fetchDMConversation,
    sendDM,
    fetchGroups,
    fetchGroupMessages,
    sendGroupMessage,
    joinGroup,
    leaveGroup,
    fetchCausalChain,
    fetchConversations,
    assignExperimentGroups,
    injectTargeted,
  }
}
