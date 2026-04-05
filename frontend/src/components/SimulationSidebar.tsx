import type { Relationship, AgentProfile, EpisodicEntry } from '../types/simulation'

interface SimulationSidebarProps {
  selectedRelationship: Relationship | null
  selectedAgent: AgentProfile | null
  agentTimeline: EpisodicEntry[]
  onClose: () => void
}

const RELATIONSHIP_COLOR: Record<string, string> = {
  INFLUENCES: '#00a8b5',
  SUPPORTS: '#22c55e',
  DISAGREES_WITH: '#ef4444',
  RELATES_TO: '#888',
}

export default function SimulationSidebar({
  selectedRelationship,
  selectedAgent,
  agentTimeline,
  onClose,
}: SimulationSidebarProps) {
  return (
    <div style={{
      width: 320,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {selectedRelationship ? 'Relationship' : selectedAgent ? 'Agent Insights' : 'Inspector'}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {selectedRelationship ? (
          <RelationshipView rel={selectedRelationship} />
        ) : selectedAgent ? (
          <AgentReasoningView agent={selectedAgent} timeline={agentTimeline} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

function RelationshipView({ rel }: { rel: Relationship }) {
  const color = RELATIONSHIP_COLOR[rel.type] ?? '#888'
  const strengthPct = Math.round(rel.strength * 100)

  return (
    <div className="fade-in">
      {/* Direction */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
        padding: '12px 14px',
        background: `${color}15`,
        borderRadius: 10,
        border: `1px solid ${color}40`,
      }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Agent {rel.sourceAgentId}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          <div style={{ flex: 1, height: 2, background: color, borderRadius: 1 }} />
          <span style={{ fontSize: 10, color, fontWeight: 600 }}>▶</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Agent {rel.targetAgentId}</span>
      </div>

      {/* Type & Strength */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-surface)',
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Type</div>
          <div style={{ fontWeight: 700, fontSize: 13, color }}>
            {rel.type.replace('_', ' ')}
          </div>
        </div>
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-surface)',
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Strength</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{strengthPct}%</div>
          <div style={{
            height: 4,
            borderRadius: 2,
            background: 'var(--border)',
            marginTop: 6,
            overflow: 'hidden',
          }}>
            <div style={{ width: `${strengthPct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Narrative reason */}
      {rel.narrative && (
        <div style={{
          padding: '12px 14px',
          background: 'var(--bg-surface)',
          borderRadius: 10,
          border: '1px solid var(--border)',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Why</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            "{rel.narrative}"
          </p>
        </div>
      )}

      {/* Timestamps */}
      {rel.createdAt && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Formed: {new Date(rel.createdAt).toLocaleTimeString()}
          {rel.updatedAt && rel.updatedAt !== rel.createdAt && (
            <span style={{ marginLeft: 8 }}>· Updated: {new Date(rel.updatedAt).toLocaleTimeString()}</span>
          )}
        </div>
      )}
    </div>
  )
}

function AgentReasoningView({ agent, timeline }: { agent: AgentProfile; timeline: EpisodicEntry[] }) {
  const allEntries = timeline.slice().reverse()

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Agent header */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-surface)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Agent {agent.id}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
          <span style={{ textTransform: 'capitalize' }}>{agent.role}</span>
          {agent.personality && <span> · {agent.personality}</span>}
        </div>
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          {agent.beliefs && agent.beliefs.length > 0 && (
            <span style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 3,
              background: 'rgba(52, 152, 219, 0.2)',
              color: '#3498db',
            }}>
              {agent.beliefs.length} beliefs
            </span>
          )}
          <span style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 3,
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--text-muted)',
          }}>
            {timeline.length} events
          </span>
        </div>
      </div>

      {/* Activity log - scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {allEntries.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px' }}>
            No activity recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allEntries.map((entry, i) => {
              const hasReasoning = !!entry.reasoning_trace
              const isHighImpact = entry.impact === 'high'

              return (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    background: isHighImpact ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface)',
                    borderRadius: 8,
                    border: isHighImpact ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border)',
                    borderLeft: hasReasoning ? '3px solid var(--accent)' : '3px solid var(--text-muted)',
                  }}
                >
                  {/* Event header with tick and AI indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      padding: '1px 6px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 3,
                    }}>
                      T{entry.tick}
                    </span>
                    {hasReasoning && (
                      <span style={{
                        fontSize: 9,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: 'rgba(168, 85, 247, 0.2)',
                        color: '#a855f7',
                        fontWeight: 600,
                      }}>
                        ✦ AI
                      </span>
                    )}
                    {isHighImpact && (
                      <span style={{
                        fontSize: 9,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        fontWeight: 600,
                      }}>
                        🔥 High Impact
                      </span>
                    )}
                    {entry.confidence !== undefined && (
                      <span style={{
                        fontSize: 9,
                        marginLeft: 'auto',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                      }}>
                        {Math.round(entry.confidence * 100)}% confident
                      </span>
                    )}
                  </div>

                  {/* Event description */}
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    marginBottom: entry.reasoning_trace || entry.influence ? 8 : 0,
                    lineHeight: 1.4,
                  }}>
                    {entry.event}
                  </div>

                  {/* Influence/reason */}
                  {entry.influence && (
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      padding: '6px 8px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 4,
                      marginBottom: entry.reasoning_trace ? 8 : 0,
                      borderLeft: '2px solid var(--accent2)',
                      fontStyle: 'italic',
                    }}>
                      💭 {entry.influence}
                    </div>
                  )}

                  {/* Detailed reasoning trace */}
                  {entry.reasoning_trace && (
                    <div style={{
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      padding: '8px',
                      background: 'rgba(168, 85, 247, 0.08)',
                      borderRadius: 4,
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                      display: 'grid',
                      gap: 6,
                    }}>
                      {Object.entries(entry.reasoning_trace).map(([key, val]) => (
                        <div key={key}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2, opacity: 0.8 }}>
                            {key.replace(/_/g, ' ')}
                          </div>
                          <div style={{ fontSize: 10, lineHeight: 1.3, color: 'var(--text-secondary)' }}>
                            {String(val)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      color: 'var(--text-muted)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.4 }}>🔍</div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        Click an agent node or relationship edge to inspect details & reasoning traces
      </div>
    </div>
  )
}
