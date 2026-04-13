import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSimulation } from '../hooks/useSimulation'
import { useAgentInspector } from '../hooks/useAgentInspector'
import { usePanelState } from '../hooks/usePanelState'
import { useExperimentLab } from '../hooks/useExperimentLab'
import AgentGraphVisualization from '../components/AgentGraphVisualization'
import ReplayControls from '../components/ReplayControls'
import AgentSearchPanel from '../components/AgentSearchPanel'
import SimulationSidebar from '../components/SimulationSidebar'
import AgentDetailDrawer from '../components/AgentDetailDrawer'
import AgentDetailModal from '../components/AgentDetailModal'
import RelationshipModal from '../components/RelationshipModal'
import InfoPlaza from '../components/InfoPlaza'
import DiscussionFeed from '../components/DiscussionFeed'
import SystemConsole from '../components/SystemConsole'
import GroupsPanel from '../components/GroupsPanel'

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
  const {
    state, connectionStatus, control, snapshot, likePost, commentPost,
    fetchAgentProfile, fetchAgentTimeline, likeAgentProfile,
    fetchGroupMessages, fetchCausalChain, assignExperimentGroups, injectTargeted,
  } = useSimulation(simId)

  // ── Focused hooks (replaces 26 flat useState calls) ────────────────────────
  const inspector = useAgentInspector({
    simId,
    fetchAgentProfile,
    fetchAgentTimeline,
    likeAgentProfile,
    fetchCausalChain,
  })

  const panels = usePanelState()

  const lab = useExperimentLab({ assignExperimentGroups, injectTargeted })

  // ── Remaining local state (speed slider, belief injection, resize, replay) ──
  const [speed, setSpeed] = useState(0.4)
  const [replayTick, setReplayTick] = useState<number | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [highlightState, setHighlightState] = useState<string | null>(null)
  const [beliefInput, setBeliefInput] = useState('')
  const [beliefLoading, setBeliefLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [networkSize, setNetworkSize] = useState({ width: 480, height: 360 })

  const initData = state.initData
  const latestTick = state.latestTick
  // When scrubbing, render from history snapshot instead of live tick
  const displayedTick = replayTick !== null ? (state.history[replayTick] ?? latestTick) : latestTick
  const stateColors = initData?.state_colors ?? {}
  const states = initData?.states ?? []
  const totalAgents = displayedTick?.total_agents ?? 0

  const handleSpeedChange = useCallback(async (v: number) => {
    setSpeed(v)
    await control('set_speed', v)
  }, [control])

  const handleAgentLikePost = useCallback(async (postId: string) => {
    if (!inspector.selectedAgentId || !simId) return
    try {
      const res = await fetch(`/api/simulations/${simId}/feed/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: inspector.selectedAgentId }),
      })
      if (!res.ok) throw new Error('Failed to like post')
      toast.success('Agent liked post!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to like post')
    }
  }, [inspector.selectedAgentId, simId])

  const handleAgentCommentPost = useCallback(async (postId: string, message: string) => {
    if (!inspector.selectedAgentId || !simId) return
    try {
      const res = await fetch(`/api/simulations/${simId}/feed/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: 'Agent', message, agentId: inspector.selectedAgentId }),
      })
      if (!res.ok) throw new Error('Failed to post comment')
      toast.success('Agent commented on post!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to post comment')
    }
  }, [inspector.selectedAgentId, simId])

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
         advancedMetrics: state.latestAdvancedMetrics ?? null,
       }

       // Persist to backend (survives page refresh); also keep sessionStorage as local fallback
       try {
         await fetch(`/api/simulations/${simId}/analysis`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(analysisData),
         })
       } catch {
         // If backend save fails, sessionStorage fallback below will still work
       }
       sessionStorage.setItem(`sim-analysis-${simId}`, JSON.stringify(analysisData))
       toast.success('Analysis saved! Redirecting...', { icon: '🔬' })
       
       setTimeout(() => {
         navigate(`/analysis/${simId}`)
       }, 1000)
     } catch (e) {
       const errMsg = e instanceof Error ? e.message : 'Stop failed'
       toast.error(errMsg)
     }
   }

   const handleInjectBelief = async () => {
     if (!beliefInput.trim()) {
       toast.error('Please enter a belief to inject')
       return
     }

     setBeliefLoading(true)
     try {
       const res = await fetch(`/api/simulations/${simId}/inject-belief`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ belief: beliefInput.trim() }),
       })

       if (!res.ok) throw new Error('Failed to inject belief')

       toast.success('💉 Belief injected to all agents!')
       setBeliefInput('')
     } catch (e) {
       const errMsg = e instanceof Error ? e.message : 'Injection failed'
       toast.error(errMsg)
     } finally {
       setBeliefLoading(false)
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

        {/* Connection status dot */}
        <div title={connectionStatus} style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: connectionStatus === 'connected' ? '#22c55e' : connectionStatus === 'reconnecting' ? '#f59e0b' : '#ef4444',
          boxShadow: connectionStatus === 'connected' ? '0 0 6px #22c55e' : connectionStatus === 'reconnecting' ? '0 0 6px #f59e0b' : '0 0 6px #ef4444',
        }} />

        {/* Live / Paused / Reconnecting indicator */}
        {connectionStatus === 'reconnecting' && (
          <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>↻ Reconnecting…</span>
        )}
        {connectionStatus === 'connected' && state.running && !state.paused && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
            <div className="stat-value" style={{ fontSize: 20 }}>{displayedTick?.tick ?? state.tick}</div>
            <div className="stat-label" style={{ color: replayTick !== null ? 'var(--accent)' : undefined }}>
              {replayTick !== null ? 'Replay' : 'Tick'}
            </div>
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
            const count = displayedTick?.state_counts[s] ?? 0
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
            onClick={() => panels.setExperimentLabOpen(true)}
            style={{ fontSize: 12, padding: '6px 14px', borderColor: 'rgba(99,102,241,0.4)', color: 'var(--accent)' }}
            title="Experiment Lab: control vs treatment groups"
          >
            🧪 Lab
          </button>
          <button
            className="btn-secondary"
            onClick={() => panels.setRightPanelOpen(!panels.rightPanelOpen)}
            style={{ fontSize: 12, padding: '6px 14px' }}
            title="Toggle right panel"
          >
            {panels.rightPanelOpen ? '▶' : '◀'}
          </button>
        </div>
      </header>

      {/* Inject belief bar */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 24px', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(8,11,20,0.6)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', marginRight: 4 }}>
          💉 INJECT:
        </span>
        <input
          type="text"
          placeholder="Type a belief to inject to all agents..."
          value={beliefInput}
          onChange={(e) => setBeliefInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !beliefLoading && handleInjectBelief()}
          disabled={beliefLoading}
          style={{
            flex: 1,
            padding: '6px 12px',
            fontSize: 11,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          className="btn-secondary"
          onClick={handleInjectBelief}
          disabled={!beliefInput.trim() || beliefLoading}
          style={{ fontSize: 11, padding: '6px 14px', borderRadius: 6 }}
        >
          {beliefLoading ? '⏳ Injecting...' : '→ Inject'}
        </button>
      </div>

       {/* Main layout: 70% left (graph) + 30% right (stacked panels) */}
       <div style={{ flex: 1, display: 'flex', gap: 12, padding: 12, minHeight: 0, overflow: 'hidden' }} className="layout-main">
         {/* Left: Agent Relationship Graph (70% width, 100% height) */}
         <div style={{
           background: 'var(--bg-card)',
           border: '1px solid var(--border)',
           borderRadius: 16,
           display: 'flex',
           flexDirection: 'column',
           overflow: 'hidden',
         }} className="layout-left" ref={containerRef}>
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
                onClick={() => { setSearchOpen(v => !v); if (searchOpen) setHighlightState(null) }}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, borderColor: searchOpen ? 'var(--accent)' : undefined, color: searchOpen ? 'var(--accent)' : undefined }}
              >
                🔍 Search
              </button>
              <button
                className="btn-secondary"
                onClick={() => panels.setSidebarOpen(v => !v)}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6 }}
              >
                {panels.sidebarOpen ? 'Hide Inspector' : 'Inspector'}
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <AgentGraphVisualization
              initData={initData}
              latestTick={displayedTick}
              relationships={state.relationships}
              width={networkSize.width}
              height={networkSize.height}
              onSelectAgent={panels.openAgentModal}
              onSelectRelationship={panels.openRelationshipModal}
              highlightState={highlightState}
            />
            {searchOpen && (
              <AgentSearchPanel
                initData={initData}
                latestTick={displayedTick}
                stateColors={stateColors}
                states={states}
                highlightState={highlightState}
                onHighlightState={setHighlightState}
                onSelectAgent={(id) => { panels.openAgentModal(id); }}
                onClose={() => { setSearchOpen(false); setHighlightState(null) }}
              />
            )}
          </div>
        </div>

         {/* Right: Stacked Panels (30% width, 100% height) - Inspector + Info Plaza + Discussion Feed */}
         {panels.rightPanelOpen && (
           <div className="layout-right" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
             {/* Inspector Panel (Agent / Relationship details) */}
             {panels.sidebarOpen && (
               <div style={{ flex: '0 0 auto', minHeight: 200, maxHeight: '40%', overflow: 'hidden' }}>
                 <SimulationSidebar
                   selectedRelationship={panels.selectedRelationship}
                   selectedAgent={null}
                   agentTimeline={[]}
                   onClose={panels.closeSidebar}
                 />
               </div>
             )}

             {/* Info Plaza - Collapsible */}
             {panels.infoPLazaOpen ? (
               <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                   <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Info Plaza</span>
                   <button
                     className="btn-icon"
                     onClick={() => panels.setInfoPlazaOpen(false)}
                     style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4 }}
                   >
                     ▼
                   </button>
                 </div>
                   <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                     <InfoPlaza
                       tick={state.tick}
                       totalAgents={totalAgents}
                       events={state.events}
                       apiCallCount={state.apiCallCount}
                       totalTokensUsed={state.totalTokensUsed}
                     />
                   </div>
               </div>
             ) : (
               <div style={{ flex: '0 0 auto' }}>
                 <button
                   className="btn-secondary"
                   onClick={() => panels.setInfoPlazaOpen(true)}
                   style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, width: '100%' }}
                 >
                   ▶ Info Plaza
                 </button>
               </div>
             )}

             {/* Discussion Feed + Groups (tabbed) */}
             <div style={{ flex: 1, minHeight: 0 }}>
               <div style={{...PANEL_STYLE.glass, height: '100%'}}>
                 {/* Tab header */}
                 <div style={{ ...PANEL_STYLE.header, padding: 0, gap: 0 }}>
                   <button
                     onClick={() => panels.setGroupsPanelOpen(false)}
                     style={{
                       flex: 1, padding: '14px 18px',
                       background: 'none', border: 'none',
                       borderBottom: !panels.groupsPanelOpen ? '2px solid var(--accent)' : '2px solid transparent',
                       color: !panels.groupsPanelOpen ? 'var(--text-secondary)' : 'var(--text-muted)',
                       fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.06em',
                       textTransform: 'uppercase',
                     }}
                   >
                     Community
                     <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 400 }}>
                       {state.discussionFeed?.length ?? 0}
                     </span>
                   </button>
                   <button
                     onClick={() => panels.setGroupsPanelOpen(true)}
                     style={{
                       flex: 1, padding: '14px 18px',
                       background: 'none', border: 'none',
                       borderBottom: panels.groupsPanelOpen ? '2px solid var(--accent)' : '2px solid transparent',
                       color: panels.groupsPanelOpen ? 'var(--text-secondary)' : 'var(--text-muted)',
                       fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.06em',
                       textTransform: 'uppercase',
                     }}
                   >
                     Groups
                     <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 400 }}>
                       {state.groups?.length ?? 0}
                     </span>
                   </button>
                 </div>

                 <div style={{ flex: 1, padding: panels.groupsPanelOpen ? 0 : 12, minHeight: 0, overflow: 'hidden' }}>
                   {panels.groupsPanelOpen ? (
                     <GroupsPanel
                       simId={simId ?? ''}
                       groups={state.groups ?? []}
                       fetchGroupMessages={fetchGroupMessages}
                       nodeStates={latestTick?.node_states}
                       stateColors={stateColors}
                     />
                   ) : (
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
                       onOpenAgent={inspector.selectAgent}
                     />
                   )}
                 </div>
               </div>
             </div>
           </div>
         )}
       </div>

       {/* Replay scrubber */}
       <ReplayControls
         history={state.history}
         replayTick={replayTick}
         onScrub={setReplayTick}
       />

       {/* Bottom: System Console (collapsible) */}
       <div style={{ borderTop: '1px solid var(--border)' }}>
         {panels.systemConsoleOpen && (
           <div style={{
             flex: '0 0 220px',
             minHeight: 180,
             maxHeight: 320,
             padding: 12,
             paddingTop: 0,
             overflow: 'hidden',
             background: 'var(--bg-card)',
           }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
               <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>System Console</span>
               <button
                 className="btn-icon"
                 onClick={() => panels.setSystemConsoleOpen(false)}
                 style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4 }}
               >
                 ▼ Hide
               </button>
             </div>
             <SystemConsole history={state.history} />
           </div>
         )}
         {!panels.systemConsoleOpen && (
           <div style={{ padding: '8px 12px' }}>
             <button
               className="btn-secondary"
               onClick={() => panels.setSystemConsoleOpen(true)}
               style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, width: '100%' }}
             >
               ▶ Show System Console
             </button>
           </div>
         )}
        </div>

        <AgentDetailDrawer
         agentId={inspector.selectedAgentId}
         profile={inspector.agentProfile}
         timeline={inspector.agentTimeline}
         isLoading={inspector.isLoadingAgent}
         timelineHasMore={inspector.agentTimelineHasMore}
         onLoadMoreTimeline={inspector.loadMoreTimeline}
         onLikeProfile={inspector.likeProfile}
         onClose={inspector.clearSelection}
         hasLiked={inspector.agentHasLiked}
         feedPosts={state.discussionFeed ?? []}
         onLikePost={handleAgentLikePost}
         onCommentPost={handleAgentCommentPost}
         onShowCausalChain={inspector.showCausalChain}
       />

       <AgentDetailModal
         agentId={panels.modalAgentId}
         simId={simId ?? null}
         isOpen={panels.isModalOpen}
         onClose={panels.closeAgentModal}
       />

       <RelationshipModal
         relationship={panels.selectedRelationship}
         isOpen={panels.relModalOpen}
         onClose={panels.closeRelationshipModal}
         discussionFeed={state.discussionFeed ?? []}
         nodeStates={latestTick?.node_states}
         stateColors={stateColors}
         simId={simId}
       />

       {/* Experiment Lab overlay */}
       {panels.experimentLabOpen && (
         <div style={{
           position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200,
           display: 'flex', alignItems: 'center', justifyContent: 'center',
         }} onClick={() => panels.setExperimentLabOpen(false)}>
           <div style={{
             background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
             padding: 28, width: 480, maxWidth: '95vw',
           }} onClick={e => e.stopPropagation()}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Experiment Lab</h2>
               <button className="btn-icon" onClick={() => panels.setExperimentLabOpen(false)}>✕</button>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
               {/* Step 1: Assign groups */}
               <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
                 <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
                   Step 1 — Assign Control / Treatment Groups
                 </div>
                 <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                   Split agents into two groups. Only the treatment group will receive targeted injections.
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                   <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130 }}>
                     Treatment: {Math.round(lab.treatmentFraction * 100)}%
                   </span>
                   <input type="range" min={0.1} max={0.9} step={0.1} value={lab.treatmentFraction}
                     onChange={e => lab.setTreatmentFraction(Number(e.target.value))}
                     style={{ flex: 1 }} />
                   <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 70 }}>
                     Control: {Math.round((1 - lab.treatmentFraction) * 100)}%
                   </span>
                 </div>
                 <button className="btn-secondary" style={{ fontSize: 12, padding: '8px 18px', width: '100%' }}
                   onClick={lab.assignGroups}>
                   {lab.groupsAssigned ? '✓ Groups Assigned — Reassign' : 'Assign Groups'}
                 </button>
               </div>

               {/* Step 2: Inject misinformation into treatment only */}
               <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 16, border: `1px solid ${lab.groupsAssigned ? 'var(--border)' : 'transparent'}`, opacity: lab.groupsAssigned ? 1 : 0.4 }}>
                 <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
                   Step 2 — Targeted Injection
                 </div>
                 <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                   Inject the seed state into one group only, then observe divergence.
                 </div>
                 <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                   {(['treatment', 'control'] as const).map(g => (
                     <button key={g} onClick={() => lab.setTargetedGroup(g)}
                       style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6, fontWeight: 600,
                         border: `1px solid ${lab.targetedGroup === g ? 'var(--accent)' : 'var(--border)'}`,
                         background: lab.targetedGroup === g ? 'rgba(99,102,241,0.15)' : 'transparent',
                         color: lab.targetedGroup === g ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}>
                       {g.charAt(0).toUpperCase() + g.slice(1)} Group
                     </button>
                   ))}
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                   <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                     Fraction: {Math.round(lab.targetedFraction * 100)}%
                   </span>
                   <input type="range" min={0.05} max={1} step={0.05} value={lab.targetedFraction}
                     onChange={e => lab.setTargetedFraction(Number(e.target.value))}
                     style={{ flex: 1 }} disabled={!lab.groupsAssigned} />
                 </div>
                 <button className="btn-secondary" disabled={!lab.groupsAssigned}
                   style={{ fontSize: 12, padding: '8px 18px', width: '100%',
                     borderColor: lab.groupsAssigned ? 'rgba(239,68,68,0.4)' : undefined,
                     color: lab.groupsAssigned ? '#ef4444' : undefined }}
                   onClick={lab.inject}>
                   Inject into {lab.targetedGroup.charAt(0).toUpperCase() + lab.targetedGroup.slice(1)} Group
                 </button>
               </div>

               <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                 Tip: After injecting, watch the graph diverge. Stop & Analyze to see group comparison in the metrics report.
               </div>
             </div>
           </div>
         </div>
       )}

       {/* Causal Chain overlay */}
       {inspector.causalChainOpen && inspector.causalChain && (
         <div style={{
           position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200,
           display: 'flex', alignItems: 'center', justifyContent: 'center',
         }} onClick={() => inspector.setCausalChainOpen(false)}>
           <div style={{
             background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
             padding: 28, width: 520, maxWidth: '95vw', maxHeight: '80vh', overflow: 'hidden',
             display: 'flex', flexDirection: 'column',
           }} onClick={e => e.stopPropagation()}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
               <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Why did this agent change?</h2>
               <button className="btn-icon" onClick={() => inspector.setCausalChainOpen(false)}>✕</button>
             </div>
             <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{inspector.causalChain!.summary}</p>
             <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
               {inspector.causalChain!.steps.length === 0 ? (
                 <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No recorded state changes yet.</div>
               ) : inspector.causalChain!.steps.map((step: any, i: number) => (
                 <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                   {/* Timeline line */}
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                     <div style={{
                       width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                       background: step.impact === 'high' ? 'var(--accent)' : 'var(--text-muted)',
                       border: `2px solid ${step.impact === 'high' ? 'var(--accent)' : 'var(--border)'}`,
                       marginTop: 3,
                     }} />
                     {i < inspector.causalChain!.steps.length - 1 && (
                       <div style={{ width: 1, flex: 1, background: 'var(--border)', minHeight: 16 }} />
                     )}
                   </div>
                   <div style={{ flex: 1, paddingBottom: 8 }}>
                     <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                       <span style={{
                         fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                         background: step.type === 'state_change' ? 'rgba(99,102,241,0.15)' :
                                     step.type === 'conversation' ? 'rgba(16,185,129,0.15)' :
                                     step.type === 'comment' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)',
                         color: step.type === 'state_change' ? 'var(--accent)' :
                                step.type === 'conversation' ? '#10b981' :
                                step.type === 'comment' ? '#f59e0b' : 'var(--text-muted)',
                         textTransform: 'uppercase',
                       }}>
                         {step.type.replace(/_/g, ' ')}
                       </span>
                       {step.tick > 0 && (
                         <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tick {step.tick}</span>
                       )}
                     </div>
                     <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                       {step.description}
                     </p>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         </div>
       )}
    </div>
  )
}
