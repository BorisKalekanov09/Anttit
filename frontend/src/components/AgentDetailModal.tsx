import React, { useState, useEffect, useCallback, memo } from 'react'
import toast from 'react-hot-toast'
import type { Belief } from '../types/simulation'

export interface AgentDetailData {
  id: string
  personality: string
  state: string
  role: string
  emotionalState: number
  emotionalStateEmoji?: string
  memorySummary: string
  recentMemory: EpisodicMemory[]
  beliefs: Belief[]
  connectedAgents: ConnectedAgent[]
  tick: number
}

export interface EpisodicMemory {
  tick: number
  event: string
  impact: 'high' | 'low'
  description?: string
  influence?: string  // agentId that triggered this memory
}

export interface ConnectedAgent {
  id: string
  personality: string
  role: string
  state: string
  influence: number
  relationshipType: 'trust' | 'distrust' | 'neutral'
  recentActivity?: string[]
}

interface AgentDetailModalProps {
  agentId: string | null
  simId: string | null
  isOpen: boolean
  onClose: () => void
}

// emotionalState from backend is -1..1; normalize to 0..100 for display
const toEmotionalPct = (state: number): number =>
  Math.round(((state + 1) / 2) * 100)

const getEmotionalStateLabel = (pct: number): string => {
  if (pct > 75) return 'Euphoric'
  if (pct > 50) return 'Happy'
  if (pct > 25) return 'Anxious'
  return 'Distressed'
}

const AgentDetailModal: React.FC<AgentDetailModalProps> = ({ agentId, simId, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'beliefs' | 'memory' | 'connections'>('overview')
  const [agentData, setAgentData] = useState<AgentDetailData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedMemIdx, setExpandedMemIdx] = useState<number | null>(null)
  const [convData, setConvData] = useState<Record<number, any[]>>({})
  const [convLoading, setConvLoading] = useState<Record<number, boolean>>({})

  const handleMemoryClick = useCallback(async (idx: number, mem: EpisodicMemory) => {
    if (expandedMemIdx === idx) {
      setExpandedMemIdx(null)
      return
    }
    setExpandedMemIdx(idx)
    if (!mem.influence || !agentId || !simId || convData[idx]) return
    setConvLoading(prev => ({ ...prev, [idx]: true }))
    try {
      const res = await fetch(`/api/simulations/${simId}/conversations/${agentId}/${mem.influence}`)
      if (res.ok) {
        const json = await res.json()
        const relevant = (json.conversations ?? []).filter((c: any) => c.tick === mem.tick || Math.abs(c.tick - mem.tick) <= 1)
        setConvData(prev => ({ ...prev, [idx]: relevant.length ? relevant : json.conversations?.slice(-1) ?? [] }))
      }
    } catch (err) {
      toast.error('Failed to load conversation')
      console.error('Failed to load conversation:', err)
    } finally {
      setConvLoading(prev => ({ ...prev, [idx]: false }))
    }
  }, [expandedMemIdx, agentId, simId, convData])

  // Fetch agent details when modal opens
  useEffect(() => {
    if (!isOpen || !agentId || !simId) {
      setAgentData(null)
      setError(null)
      setExpandedMemIdx(null)
      setConvData({})
      setConvLoading({})
      return
    }

    const fetchAgentDetails = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/simulations/${simId}/agents/${agentId}/details`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Agent not found')
          } else {
            setError(`Failed to load agent details (${response.status})`)
          }
          return
        }
        const data: AgentDetailData = await response.json()
        setAgentData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch agent details')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAgentDetails()
  }, [isOpen, agentId, simId])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div style={styles.backdrop} onClick={onClose} />

      {/* Modal Panel */}
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            {isLoading ? (
              <h2 style={styles.title}>Loading Agent...</h2>
            ) : error ? (
              <h2 style={styles.title}>⚠️ {error}</h2>
             ) : agentData ? (
               <>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                   <div>
                     <h2 style={styles.title}>{agentData.personality}</h2>
                     <p style={styles.subtitle}>
                       {agentData.role} • {agentData.state} • Tick {agentData.tick}
                     </p>
                   </div>
                 </div>
               </>
             ) : (
              <h2 style={styles.title}>Agent Details</h2>
            )}
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        {!isLoading && !error && agentData && (
          <div style={styles.tabNav}>
            {(['overview', 'beliefs', 'memory', 'connections'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  ...styles.tabButton,
                  borderBottomColor: activeTab === tab ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {tab === 'overview' && '👁 Overview'}
                {tab === 'beliefs' && '💭 Beliefs'}
                {tab === 'memory' && '📝 Memory'}
                {tab === 'connections' && '🔗 Connections'}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div style={styles.content}>
          {isLoading && (
            <div style={styles.centered}>
              <p style={styles.loadingText}>Fetching agent data...</p>
            </div>
          )}

          {error && (
            <div style={styles.centered}>
              <p style={styles.errorText}>{error}</p>
            </div>
          )}

          {agentData && !isLoading && !error && (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div style={styles.tabContent}>
                   <section style={styles.section}>
                     <h3 style={styles.sectionTitle}>Current State</h3>
                     <div style={styles.statGrid}>
                       <div style={styles.statItem}>
                         <span style={styles.statLabel}>State</span>
                         <span style={styles.statValue}>{agentData.state}</span>
                       </div>
                       <div style={styles.statItem}>
                         <span style={styles.statLabel}>Role</span>
                         <span style={styles.statValue}>{agentData.role}</span>
                       </div>
                       <div style={styles.statItem}>
                         <span style={styles.statLabel}>Mood</span>
                         <span style={styles.statValue}>{getEmotionalStateLabel(toEmotionalPct(agentData.emotionalState ?? 0))}</span>
                       </div>
                       <div style={styles.statItem}>
                         <span style={styles.statLabel}>Emotional Energy ({toEmotionalPct(agentData.emotionalState ?? 0)}%)</span>
                         <div style={styles.progressBar}>
                           <div
                             style={{
                               ...styles.progressFill,
                               width: `${toEmotionalPct(agentData.emotionalState ?? 0)}%`,
                             }}
                           />
                         </div>
                       </div>
                     </div>
                   </section>

                   <section style={styles.section}>
                     <h3 style={styles.sectionTitle}>Memory Summary</h3>
                     <p style={styles.summary}>{agentData.memorySummary || 'No memory summary available yet'}</p>
                   </section>

                   <section style={styles.section}>
                     <h3 style={styles.sectionTitle}>Recent Events</h3>
                     {agentData.recentMemory && agentData.recentMemory.length > 0 ? (
                       <div style={styles.eventList}>
                         {agentData.recentMemory.slice(0, 5).map((mem, idx) => (
                           <div key={idx} style={styles.eventItem}>
                             <span style={styles.eventTick}>Tick {mem.tick}</span>
                             <span style={styles.eventText}>{mem.event}</span>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <p style={styles.emptyState}>No recent memories</p>
                     )}
                   </section>
                </div>
              )}

              {/* Beliefs Tab */}
              {activeTab === 'beliefs' && (
                <div style={styles.tabContent}>
                  {agentData.beliefs && agentData.beliefs.length > 0 ? (
                    <div style={styles.beliefList}>
                      {agentData.beliefs.map((belief, idx) => (
                        <div key={idx} style={styles.beliefItem}>
                          <div style={styles.beliefHeader}>
                            <span style={styles.beliefTopic}>{belief.topic}</span>
                            <span style={styles.beliefWeight}>{Math.round(belief.weight * 100)}% conviction</span>
                          </div>
                          <div style={styles.beliefBar}>
                            <div
                              style={{
                                ...styles.beliefFill,
                                width: `${belief.weight * 100}%`,
                              }}
                            />
                          </div>
                          {belief.position && (
                            <div style={{...styles.beliefPosition, marginTop: 8}}>
                              <strong>Position:</strong> {belief.position}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.centered}>
                      <p style={styles.emptyState}>No beliefs recorded yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* Memory Timeline Tab */}
              {activeTab === 'memory' && (
                <div style={styles.tabContent}>
                  {agentData.recentMemory && agentData.recentMemory.length > 0 ? (
                    <div style={styles.timeline}>
                      {agentData.recentMemory.map((mem, idx) => (
                        <div key={idx}>
                          <div
                            style={{
                              ...styles.timelineEntry,
                              cursor: mem.influence ? 'pointer' : 'default',
                              borderColor: expandedMemIdx === idx ? 'var(--accent)' : 'var(--border)',
                            }}
                            onClick={() => mem.influence && handleMemoryClick(idx, mem)}
                          >
                            <div style={styles.timelineMarker} />
                            <div style={styles.timelineBody}>
                              <div style={styles.timelineEvent}>
                                <strong style={styles.eventTick}>Tick {mem.tick}</strong>
                                <span style={styles.timelineText}>{mem.event}</span>
                                {mem.influence && (
                                  <span style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>
                                    {expandedMemIdx === idx ? '▲ hide' : '▼ talk'}
                                  </span>
                                )}
                              </div>
                              {mem.description && (
                                <p style={styles.timelineDescription}>{mem.description}</p>
                              )}
                              <div style={styles.timelineMeta}>
                                <span
                                  style={{
                                    ...styles.impactBadge,
                                    background: mem.impact === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                                    color: mem.impact === 'high' ? '#ef4444' : '#6b7280',
                                  }}
                                >
                                  {mem.impact} impact
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Conversation viewer */}
                          {expandedMemIdx === idx && mem.influence && (
                            <div style={styles.convPanel}>
                              {convLoading[idx] ? (
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Loading conversation...</p>
                              ) : convData[idx] && convData[idx].length > 0 ? (
                                convData[idx].map((conv: any, ci: number) => (
                                  <div key={ci} style={styles.convEntry}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                      Tick {conv.tick} · {conv.agentAName} ↔ {conv.agentBName}
                                    </div>
                                    {(conv.messages ?? []).map((msg: any, mi: number) => (
                                      <div key={mi} style={{
                                        ...styles.convBubble,
                                        alignSelf: msg.agentId === agentId ? 'flex-end' : 'flex-start',
                                        background: msg.agentId === agentId ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                                      }}>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                                          {msg.agentName}
                                        </span>
                                        <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{msg.content}</span>
                                      </div>
                                    ))}
                                  </div>
                                ))
                              ) : (
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>No conversation found for this event</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.centered}>
                      <p style={styles.emptyState}>No memory events recorded</p>
                    </div>
                  )}
                </div>
              )}

              {/* Connections Tab */}
              {activeTab === 'connections' && (
                <div style={styles.tabContent}>
                  {agentData.connectedAgents && agentData.connectedAgents.length > 0 ? (
                    <div style={styles.connectionList}>
                      {agentData.connectedAgents.map((agent, idx) => (
                        <div key={idx} style={styles.connectionItem}>
                          <div style={styles.connectionHeader}>
                            <div>
                              <div style={styles.connectionName}>{agent.personality}</div>
                              <div style={styles.connectionRole}>{agent.role}</div>
                            </div>
                            <div style={styles.connectionState}>
                              <span
                                style={{
                                  ...styles.stateBadge,
                                  background: `rgba(59, 130, 246, ${agent.influence / 100})`,
                                }}
                              >
                                {agent.state}
                              </span>
                            </div>
                          </div>

                          <div style={styles.connectionMeta}>
                            <div style={styles.influenceBar}>
                              <span style={styles.influenceLabel}>Influence</span>
                              <div style={styles.bar}>
                                <div
                                  style={{
                                    ...styles.barFill,
                                    width: `${Math.min(100, agent.influence)}%`,
                                  }}
                                />
                              </div>
                              <span style={styles.influenceValue}>{agent.influence}%</span>
                            </div>
                          </div>

                          <div style={{
                            ...styles.connectionType,
                            background: agent.relationshipType === 'trust' ? 'rgba(34, 197, 94, 0.15)' : agent.relationshipType === 'distrust' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                            color: agent.relationshipType === 'trust' ? '#22c55e' : agent.relationshipType === 'distrust' ? '#ef4444' : '#6b7280',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            display: 'inline-block',
                          }}>
                            {agent.relationshipType === 'trust' ? '✓ Trusted' : agent.relationshipType === 'distrust' ? '✗ Distrusted' : '• Neutral'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.centered}>
                      <p style={styles.emptyState}>No connected agents</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1099,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    cursor: 'pointer',
    pointerEvents: 'auto',
  },
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1100,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    width: '90%',
    maxWidth: 600,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
    animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    gap: 12,
  },
  headerContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  emoji: {
    fontSize: '28px',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 6,
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  tabNav: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(255, 255, 255, 0.01)',
    padding: '0 16px',
    gap: 4,
    flexShrink: 0,
  },
  tabButton: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-secondary)',
    padding: '12px 12px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    letterSpacing: '0.05em',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  statItem: {
    padding: 12,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  progressBar: {
    height: 6,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  summary: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  eventItem: {
    padding: 10,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
  },
  eventTick: {
    fontWeight: 600,
    color: 'var(--accent)',
    minWidth: '60px',
    flexShrink: 0,
  },
  eventText: {
    flex: 1,
    color: 'var(--text-secondary)',
    minWidth: 0,
  },
  eventBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    flexShrink: 0,
  },
  beliefList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  beliefItem: {
    padding: 10,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  beliefHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beliefTopic: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  beliefWeight: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  beliefBar: {
    height: 6,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  beliefFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent2), var(--accent))',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  timelineEntry: {
    display: 'flex',
    gap: 10,
    padding: 10,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border)',
    borderRadius: 6,
  },
  timelineMarker: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--accent)',
    marginTop: 4,
    flexShrink: 0,
  },
  timelineBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  timelineEvent: {
    display: 'flex',
    gap: 6,
    fontSize: 12,
  },
  timelineText: {
    color: 'var(--text-secondary)',
    flex: 1,
    minWidth: 0,
    wordBreak: 'break-word',
  },
  timelineDescription: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  timelineMeta: {
    display: 'flex',
    gap: 8,
  },
  impactBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  connectionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  connectionItem: {
    padding: 12,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  connectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  connectionName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  connectionRole: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    marginTop: 2,
  },
  connectionState: {
    display: 'flex',
    gap: 4,
  },
  stateBadge: {
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  connectionMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  influenceBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
  },
  influenceLabel: {
    color: 'var(--text-secondary)',
    fontWeight: 600,
    minWidth: '60px',
  },
  bar: {
    flex: 1,
    height: 4,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'var(--accent)',
    transition: 'width 0.3s ease',
  },
  influenceValue: {
    color: 'var(--text-secondary)',
    fontWeight: 600,
    minWidth: '35px',
    textAlign: 'right',
  },
  connectionNarrative: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '8px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderLeft: '2px solid var(--accent)',
    borderRadius: 4,
  },
  connectionType: {
    fontSize: 10,
    color: 'var(--text-secondary)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  centered: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  loadingText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  errorText: {
    margin: 0,
    color: '#ef4444',
    fontSize: 13,
  },
  emptyState: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
    textAlign: 'center',
    padding: 20,
  },
  convPanel: {
    margin: '4px 0 8px 0',
    padding: 12,
    background: 'rgba(99, 102, 241, 0.06)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  convEntry: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  convBubble: {
    maxWidth: '85%',
    padding: '6px 10px',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  beliefPosition: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
}

export default memo(AgentDetailModal)
