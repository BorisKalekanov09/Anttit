import type { Relationship, AgentProfile, EpisodicEntry } from '../types/simulation'

interface SimulationSidebarProps {
  selectedRelationship: Relationship | null
  selectedAgent: AgentProfile | null
  agentTimeline: EpisodicEntry[]
  onClose: () => void
}

const RELATIONSHIP_COLOR: Record<string, string> = {
  INFLUENCES: '#4a90e2',
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
  const tracedEntries = timeline.filter((e): e is EpisodicEntry & { reasoning_trace: NonNullable<EpisodicEntry['reasoning_trace']> } =>
    !!e.reasoning_trace
  )

  return (
    <div className="fade-in">
      {/* Agent header */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-surface)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        marginBottom: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Agent {agent.id}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <span style={{ textTransform: 'capitalize' }}>{agent.role}</span>
          {agent.personality && <span> · {agent.personality}</span>}
        </div>
      </div>

      {tracedEntries.length > 0 ? (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Reasoning traces ({tracedEntries.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tracedEntries.slice(-5).reverse().map((entry, i) => (
              <div key={i} style={{
                padding: '12px 14px',
                background: 'var(--bg-surface)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>
                  Tick {entry.tick} — {entry.event}
                  {entry.confidence !== undefined && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                      ({Math.round(entry.confidence * 100)}% confident)
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(entry.reasoning_trace).map(([key, val]) => (
                    <div key={key}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                        {key.replace(/_/g, ' ')}
                      </div>
                       <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{String(val)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          No reasoning traces yet.
          <br />
          <span style={{ fontSize: 11 }}>Traces appear after AI-driven decisions.</span>
        </div>
      )}
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
