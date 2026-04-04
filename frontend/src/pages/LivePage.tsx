import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSimulation } from '../hooks/useSimulation'
import AgentGraphVisualization from '../components/AgentGraphVisualization'
import SimulationSidebar from '../components/SimulationSidebar'
import AgentDetailDrawer from '../components/AgentDetailDrawer'
import InfoPlaza from '../components/InfoPlaza'
import DiscussionFeed from '../components/DiscussionFeed'
import SystemConsole from '../components/SystemConsole'
import type { Relationship } from '../types/simulation'

const PANEL_STYLE = {
  glass: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
    fontWeight: 700,
    fontSize: 13,
    color: 'var(--text-secondary)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
    padding: '16px',
    overflow: 'hidden',
  },
}

export default function LivePage() {
  const { simId } = useParams<{ simId: string }>()
  const navigate = useNavigate()
  const { state, control, inject, snapshot, likePost, commentPost, fetchAgentProfile, fetchAgentTimeline, likeAgentProfile } = useSimulation(simId)
  const [speed, setSpeed] = useState(0.4)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [whatIfInput, setWhatIfInput] = useState('')
  const [whatIfLoading, setWhatIfLoading] = useState(false)
  const [showWhatIfConfirm, setShowWhatIfConfirm] = useState(false)
  const [pendingWhatIf, setPendingWhatIf] = useState<{ eventType: string; payload: object; preview: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [networkSize, setNetworkSize] = useState({ width: 480, height: 360 })
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [agentProfile, setAgentProfile] = useState<any>(null)
  const [agentTimeline, setAgentTimeline] = useState<any[]>([])
  const [agentTimelineHasMore, setAgentTimelineHasMore] = useState(false)
  const [isLoadingAgent, setIsLoadingAgent] = useState(false)
  const [timelineOffset, setTimelineOffset] = useState(0)
  const [agentHasLiked, setAgentHasLiked] = useState(false)
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarAgentProfile, setSidebarAgentProfile] = useState<any>(null)

  const initData = state.initData
  const latestTick = state.latestTick
  const stateColors = initData?.state_colors ?? {}
  const states = initData?.states ?? []
  const totalAgents = latestTick?.total_agents ?? 0

  const handleSpeedChange = useCallback(async (v: number) => {
    setSpeed(v)
    await control('set_speed', v)
  }, [control])

  const handleSelectAgent = useCallback(async (agentId: string) => {
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
    } catch (e) {
      console.error('Failed to load agent profile:', e)
      toast.error('Failed to load agent details')
    } finally {
      setIsLoadingAgent(false)
    }
  }, [fetchAgentProfile, fetchAgentTimeline])

  // Graph node click → opens SimulationSidebar only (no backdrop from AgentDetailDrawer)
  const handleGraphNodeClick = useCallback(async (agentId: string) => {
    setSelectedRelationship(null)
    setSidebarAgentProfile(null)
    setSidebarOpen(true)
    try {
      const profile = await fetchAgentProfile(agentId)
      setSidebarAgentProfile(profile)
    } catch {
      // non-critical, sidebar will show empty state
    }
  }, [fetchAgentProfile])

  const handleLoadMoreTimeline = useCallback(async () => {
    if (!selectedAgentId) return
    try {
      const timeline = await fetchAgentTimeline(selectedAgentId, timelineOffset)
      if (timeline) {
        setAgentTimeline(prev => [...prev, ...(timeline.data ?? [])])
        setAgentTimelineHasMore(timeline.pagination?.hasMore ?? false)
        setTimelineOffset(prev => prev + (timeline.data?.length ?? 0))
      }
    } catch (e) {
      console.error('Failed to load more timeline:', e)
      toast.error('Failed to load more timeline')
    }
  }, [selectedAgentId, timelineOffset, fetchAgentTimeline])

  const handleLikeAgentProfile = useCallback(async () => {
    if (!selectedAgentId) return
    try {
      const result = await likeAgentProfile(selectedAgentId)
      if (result === null) {
        // Already liked (409 status from backend)
        toast('Already liked this profile')
        return
      }
      setAgentHasLiked(true)
      if (agentProfile) {
        setAgentProfile({
          ...agentProfile,
          profileLikes: (agentProfile.profileLikes ?? 0) + 1,
        })
      }
      toast.success('Profile liked!')
    } catch (e) {
      console.error('Failed to like profile:', e)
      toast.error('Failed to like profile')
    }
  }, [selectedAgentId, likeAgentProfile, agentProfile])

  const handleAgentLikePost = useCallback(async (postId: string) => {
    if (!selectedAgentId || !simId) return
    try {
      const res = await fetch(`/api/simulations/${simId}/feed/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgentId }),
      })
      if (!res.ok) throw new Error('Failed to like post')
      toast.success('Agent liked post!')
    } catch (e) {
      console.error('Failed to like post:', e)
      toast.error('Failed to like post')
    }
  }, [selectedAgentId, simId])

  const handleAgentCommentPost = useCallback(async (postId: string, message: string) => {
    if (!selectedAgentId || !simId) return
    try {
      const res = await fetch(`/api/simulations/${simId}/feed/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: 'Agent',
          message,
          agentId: selectedAgentId,
        }),
      })
      if (!res.ok) throw new Error('Failed to post comment')
      toast.success('Agent commented on post!')
    } catch (e) {
      console.error('Failed to comment:', e)
      toast.error('Failed to post comment')
    }
  }, [selectedAgentId, simId])

  const handleSnapshot = async () => {
    const data = await snapshot()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sim-${simId}-tick${state.tick}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Snapshot exported!')
  }

  const handleWhatIfPreview = async () => {
    if (!whatIfInput.trim()) {
      toast.error('Please describe a what-if scenario')
      return
    }
    
    setWhatIfLoading(true)
    try {
      const res = await fetch(`/api/simulations/${simId}/whatif`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: whatIfInput }),
      })
      
      if (!res.ok) throw new Error('What-if analysis failed')
      
      const data = await res.json()
      
      if (!data.eventType || !data.payload || !data.preview) {
        throw new Error('Invalid what-if response format')
      }
      
      toast.success('📊 What-if scenario analyzed. Review & confirm injection?')
      setPendingWhatIf({
        eventType: data.eventType,
        payload: data.payload,
        preview: data.preview,
      })
      setShowWhatIfConfirm(true)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'What-if analysis failed'
      toast.error(errMsg)
    } finally {
      setWhatIfLoading(false)
    }
  }

  const handleWhatIfConfirm = async () => {
    if (!pendingWhatIf) return
    
    try {
      await inject(pendingWhatIf.eventType, pendingWhatIf.payload)
      toast.success('✅ What-if scenario injected!')
      setWhatIfInput('')
      setPendingWhatIf(null)
      setShowWhatIfConfirm(false)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Injection failed'
      toast.error(errMsg)
    }
  }

  const handleStop = async () => {
    try {
      await control('stop')
      
      await new Promise(r => setTimeout(r, 1000))
      
      // Compute peak velocity: largest absolute change in total agents between consecutive ticks
      let peakVelocityTick = 0
      let peakVelocity = 0
      if (state.history.length > 1) {
        for (let i = 1; i < state.history.length; i++) {
          const prev = state.history[i - 1].total_agents
          const curr = state.history[i].total_agents
          const delta = Math.abs(curr - prev)
          if (delta > peakVelocity) {
            peakVelocity = delta
            peakVelocityTick = state.history[i].tick
          }
        }
      }
      
      const analysisKey = `sim-analysis-${simId}`
      const analysisData = {
        report: state.analysisReport || {
          summary: 'Analysis generation in progress...',
          timeline: `Simulation completed at tick ${state.tick} with ${state.latestTick?.total_agents ?? 0} agents`,
          personalities: {},
          realWorldParallel: 'See full analysis for details',
          recommendations: [],
        },
        stats: {
          totalTicks: state.tick,
          agentCount: state.latestTick?.total_agents ?? 0,
          dominantState: Object.entries(state.latestTick?.state_counts ?? {}).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'unknown',
          peakVelocityTick,
        },
        history: state.history,
        states: states,
        stateColors: stateColors,
      }
      
      sessionStorage.setItem(analysisKey, JSON.stringify(analysisData))
      toast.success('Analysis saved! Redirecting...', { icon: '🔬' })
      
      setTimeout(() => {
        navigate(`/analysis/${simId}`)
      }, 1000)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Stop failed'
      toast.error(errMsg)
    }
  }

  // Responsive sizing for AgentNetwork
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const newWidth = Math.max(300, rect.width - 32)
        const newHeight = Math.max(200, rect.height - 80)
        setNetworkSize({ width: newWidth, height: newHeight })
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    handleResize() // Initial size

    return () => resizeObserver.disconnect()
  }, [])

  return (
    <div style={{ height: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(14,21,37,0.9)',
        backdropFilter: 'blur(20px)',
        flexShrink: 0,
      }}>
        <button className="btn-icon" onClick={() => navigate('/')} title="Back">←</button>
        <div>
          <span className="gradient-text" style={{ fontWeight: 800, fontSize: 16 }}>AgentSim</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
            {initData?.theme ?? 'Loading...'}
          </span>
        </div>

        {/* Live indicator */}
        {state.running && !state.paused && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              animation: 'glow-pulse 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>LIVE</span>
          </div>
        )}
        {state.paused && (
          <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>⏸ PAUSED</span>
        )}

        <div style={{ flex: 1 }} />

        {/* Tick counter */}
        <div className="stat-card" style={{ padding: '8px 16px', flexDirection: 'row', gap: 12 }}>
          <div>
            <div className="stat-value" style={{ fontSize: 20 }}>{state.tick}</div>
            <div className="stat-label">Tick</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div>
            <div className="stat-value" style={{ fontSize: 20 }}>{totalAgents}</div>
            <div className="stat-label">Agents</div>
          </div>
        </div>

        {/* State counts */}
        <div style={{ display: 'flex', gap: 6 }}>
          {states.map(s => {
            const count = latestTick?.state_counts[s] ?? 0
            const pct = totalAgents > 0 ? ((count / totalAgents) * 100).toFixed(0) : '0'
            return (
              <div key={s} className="stat-card" style={{ padding: '6px 12px', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: stateColors[s] ?? '#888' }} />
                  <span style={{ fontSize: 18, fontWeight: 800, color: stateColors[s] ?? '#888' }}>{pct}%</span>
                </div>
                <div className="stat-label">{s.replace(/_/g, ' ')}</div>
              </div>
            )
          })}
        </div>

        {/* Speed slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Speed</span>
          <input
            type="range" min={0.05} max={3} step={0.05}
            value={speed}
            onChange={e => handleSpeedChange(Number(e.target.value))}
            style={{ width: 80 }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {speed.toFixed(1)}s
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 6 }}>
          {state.paused ? (
            <button className="btn-secondary" onClick={() => control('resume')} style={{ fontSize: 12, padding: '6px 14px' }}>
              ▶ Resume
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => control('pause')} style={{ fontSize: 12, padding: '6px 14px' }}>
              ⏸ Pause
            </button>
          )}
          <button className="btn-secondary" onClick={handleSnapshot} style={{ fontSize: 12, padding: '6px 14px' }}>
            💾 Export
          </button>
          <button
            className="btn-secondary"
            onClick={handleStop}
            style={{ fontSize: 12, padding: '6px 14px', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}
          >
            ■ Stop & Analyze
          </button>
          <button
            className="btn-secondary"
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            style={{ fontSize: 12, padding: '6px 14px' }}
            title="Toggle right panel"
          >
            {rightPanelOpen ? '▶' : '◀'}
          </button>
        </div>
      </header>

      {/* Inject events bar */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(8,11,20,0.6)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', marginRight: 4 }}>
          INJECT:
        </span>
        <button
          className="btn-secondary"
          onClick={() => { inject('rumour_burst'); toast('💥 Rumour burst injected!') }}
          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6 }}
        >
          💥 Rumour Burst
        </button>
        <button
          className="btn-secondary"
          onClick={() => { inject('reset_random'); toast('🔀 States randomized!') }}
          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6 }}
        >
          🔀 Randomize States
        </button>
      </div>

      {/* Main layout: top row (graph + right panel) + bottom console */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Top row: left graph + right stacked panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          padding: 12,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Left: Agent Relationship Graph (full width minus sidebar) */}
          <div style={{
            flex: '1 1 65%',
            minWidth: 520,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }} ref={containerRef}>
            <div style={{...PANEL_STYLE.header, gap: 8}}>
              <span>🕸 Agent Relationship Graph</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>
                  {state.relationships.length > 0
                    ? `${state.relationships.length} relationships`
                    : 'topology edges'}
                </span>
                <button
                  className="btn-secondary"
                  onClick={() => setSidebarOpen(v => !v)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6 }}
                >
                  {sidebarOpen ? 'Hide Inspector' : 'Inspector'}
                </button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <AgentGraphVisualization
                initData={initData}
                latestTick={latestTick}
                relationships={state.relationships}
                width={networkSize.width}
                height={networkSize.height}
                onSelectAgent={handleGraphNodeClick}
                onSelectRelationship={(rel) => {
                  setSelectedRelationship(rel)
                  setSidebarAgentProfile(null)
                  setSidebarOpen(true)
                }}
              />
            </div>
          </div>

          {/* Sidebar: relationship / agent inspector */}
          {sidebarOpen && (
            <SimulationSidebar
              selectedRelationship={selectedRelationship}
              selectedAgent={sidebarAgentProfile ?? null}
              agentTimeline={[]}
              onClose={() => { setSidebarOpen(false); setSidebarAgentProfile(null); setSelectedRelationship(null) }}
            />
          )}

          {/* Right: Stacked Panel (Info Plaza + Discussion Feed) (35% min 320px) */}
          {rightPanelOpen && (
            <div style={{
              flex: '1 1 35%',
              minWidth: 320,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 0,
            }}>
              {/* Info Plaza */}
              <div style={{ flex: 0.4, minHeight: 0 }}>
                <InfoPlaza
                  tick={state.tick}
                  totalAgents={totalAgents}
                  events={state.events}
                  discussionPostCount={state.discussionFeed?.length ?? 0}
                  latestTick={latestTick}
                  whatIfInput={whatIfInput}
                  onWhatIfInputChange={setWhatIfInput}
                  onWhatIfPreview={handleWhatIfPreview}
                  whatIfLoading={whatIfLoading}
                  stateColors={stateColors}
                />
              </div>

              {/* Discussion Feed */}
              <div style={{ flex: 0.6, minHeight: 0 }}>
                <div style={{...PANEL_STYLE.glass, height: '100%'}}>
                  <div style={PANEL_STYLE.header}>
                    <span>TOPIC COMMUNITY</span>
                    <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>
                      {state.discussionFeed?.length ?? 0} posts
                    </span>
                  </div>
                  <div style={{ flex: 1, padding: 12, minHeight: 0, overflow: 'hidden' }}>
                    <DiscussionFeed
                       posts={state.discussionFeed ?? []}
                       personalities={initData?.personalities ?? []}
                       onLike={(postId) => {
                         likePost(postId).catch(e => 
                           toast.error(e instanceof Error ? e.message : 'Failed to like post')
                         )
                       }}
                        onComment={(postId, _author, message) => {
                           commentPost(postId, message).catch(e => 
                             toast.error(e instanceof Error ? e.message : 'Failed to post comment')
                           )
                         }}
                       onOpenAgent={handleSelectAgent}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom: System Console (220px, min 180 max 320) */}
        <div style={{
          flex: '0 0 220px',
          minHeight: 180,
          maxHeight: 320,
          padding: 12,
          paddingTop: 0,
          overflow: 'hidden',
        }}>
          <SystemConsole history={state.history} />
        </div>
      </div>

      {/* What-If Confirmation Dialog */}
      {showWhatIfConfirm && pendingWhatIf && (
        <div 
          className="modal-overlay" 
          onClick={e => { if (e.target === e.currentTarget) setShowWhatIfConfirm(false) }}
        >
          <div className="modal">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--gradient-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>🔮</div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>What-If Impact Preview</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review the predicted scenario effects</p>
              </div>
            </div>
            <div style={{ 
              background: 'var(--bg-surface)', 
              padding: '16px',
              borderRadius: 12,
              marginBottom: 24,
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {pendingWhatIf.preview}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowWhatIfConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleWhatIfConfirm}
              >
                ✓ Inject & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <AgentDetailDrawer
        agentId={selectedAgentId}
        profile={agentProfile}
        timeline={agentTimeline}
        isLoading={isLoadingAgent}
        timelineHasMore={agentTimelineHasMore}
        onLoadMoreTimeline={handleLoadMoreTimeline}
        onLikeProfile={handleLikeAgentProfile}
        onClose={() => setSelectedAgentId(null)}
        hasLiked={agentHasLiked}
        feedPosts={state.discussionFeed ?? []}
        onLikePost={handleAgentLikePost}
        onCommentPost={handleAgentCommentPost}
      />
    </div>
  )
}
