import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import type { AgentProfile, CausalChain } from '../types/simulation'

interface UseAgentInspectorOptions {
  simId: string | undefined
  fetchAgentProfile: (id: string) => Promise<AgentProfile | null>
  fetchAgentTimeline: (id: string, offset?: number, limit?: number) => Promise<any>
  likeAgentProfile: (id: string) => Promise<AgentProfile | null>
  fetchCausalChain: (id: string) => Promise<CausalChain | null>
}

export function useAgentInspector({
  fetchAgentProfile,
  fetchAgentTimeline,
  likeAgentProfile,
  fetchCausalChain,
}: UseAgentInspectorOptions) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [agentProfile, setAgentProfile] = useState<any>(null)
  const [agentTimeline, setAgentTimeline] = useState<any[]>([])
  const [agentTimelineHasMore, setAgentTimelineHasMore] = useState(false)
  const [isLoadingAgent, setIsLoadingAgent] = useState(false)
  const [timelineOffset, setTimelineOffset] = useState(0)
  const [agentHasLiked, setAgentHasLiked] = useState(false)
  const [causalChain, setCausalChain] = useState<CausalChain | null>(null)
  const [causalChainOpen, setCausalChainOpen] = useState(false)

  const selectAgent = useCallback(async (agentId: string) => {
    setSelectedAgentId(agentId)
    setIsLoadingAgent(true)
    setAgentProfile(null)
    setAgentTimeline([])
    setTimelineOffset(0)
    setAgentHasLiked(false)

    try {
      const profile = await fetchAgentProfile(agentId)
      setAgentProfile(profile)
      setAgentHasLiked(profile?.viewerHasLiked ?? false)

      const timeline = await fetchAgentTimeline(agentId, 0)
      if (timeline) {
        setAgentTimeline(timeline.data ?? [])
        setAgentTimelineHasMore(timeline.pagination?.hasMore ?? false)
        setTimelineOffset(timeline.data?.length ?? 0)
      }
    } catch {
      toast.error('Failed to load agent details')
    } finally {
      setIsLoadingAgent(false)
    }
  }, [fetchAgentProfile, fetchAgentTimeline])

  const loadMoreTimeline = useCallback(async () => {
    if (!selectedAgentId) return
    try {
      const timeline = await fetchAgentTimeline(selectedAgentId, timelineOffset)
      if (timeline) {
        setAgentTimeline(prev => [...prev, ...(timeline.data ?? [])])
        setAgentTimelineHasMore(timeline.pagination?.hasMore ?? false)
        setTimelineOffset(prev => prev + (timeline.data?.length ?? 0))
      }
    } catch {
      toast.error('Failed to load more timeline')
    }
  }, [selectedAgentId, timelineOffset, fetchAgentTimeline])

  const likeProfile = useCallback(async () => {
    if (!selectedAgentId) return
    try {
      const result = await likeAgentProfile(selectedAgentId)
      if (result === null) {
        toast('Already liked this profile')
        return
      }
      setAgentHasLiked(true)
      setAgentProfile((prev: any) => prev ? { ...prev, profileLikes: (prev.profileLikes ?? 0) + 1 } : prev)
      toast.success('Profile liked!')
    } catch {
      toast.error('Failed to like profile')
    }
  }, [selectedAgentId, likeAgentProfile])

  const showCausalChain = useCallback(async (agentId: string) => {
    const chain = await fetchCausalChain(agentId)
    if (chain) {
      setCausalChain(chain)
      setCausalChainOpen(true)
    } else {
      toast.error('No causal data yet for this agent')
    }
  }, [fetchCausalChain])

  const clearSelection = useCallback(() => {
    setSelectedAgentId(null)
    setAgentProfile(null)
    setAgentTimeline([])
  }, [])

  return {
    selectedAgentId,
    agentProfile,
    agentTimeline,
    agentTimelineHasMore,
    isLoadingAgent,
    agentHasLiked,
    causalChain,
    causalChainOpen,
    setCausalChainOpen,
    selectAgent,
    loadMoreTimeline,
    likeProfile,
    showCausalChain,
    clearSelection,
  }
}
