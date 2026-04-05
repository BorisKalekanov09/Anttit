import { useMemo, useState, useEffect } from 'react'
import type { Relationship, DiscussionPost, DirectMessage } from '../types/simulation'

const REL_COLORS: Record<string, string> = {
  INFLUENCES: '#00a8b5',
  SUPPORTS: '#22c55e',
  DISAGREES_WITH: '#ef4444',
  RELATES_TO: '#888',
}

interface RelationshipModalProps {
  relationship: Relationship | null
  isOpen: boolean
  onClose: () => void
  discussionFeed: DiscussionPost[]
  nodeStates?: Record<string, string>
  stateColors?: Record<string, string>
  simId?: string
}

export default function RelationshipModal({
  relationship,
  isOpen,
  onClose,
  discussionFeed,
  nodeStates = {},
  stateColors = {},
  simId,
}: RelationshipModalProps) {
  const [activeTab, setActiveTab] = useState<'dms' | 'feed'>('dms')
  const [dms, setDms] = useState<DirectMessage[]>([])
  const [dmLoading, setDmLoading] = useState(false)

  // Fetch DMs when modal opens
  useEffect(() => {
    if (!isOpen || !relationship || !simId) return
    setDmLoading(true)
    const { sourceAgentId: a, targetAgentId: b } = relationship
    fetch(`/api/simulations/${simId}/dms/conversation/${a}/${b}`)
      .then(r => r.ok ? r.json() : { dms: [] })
      .then(data => setDms(data.dms ?? []))
      .catch(() => setDms([]))
      .finally(() => setDmLoading(false))
  }, [isOpen, relationship, simId])

  // Reset to DMs tab when a new relationship is selected
  useEffect(() => {
    if (isOpen) setActiveTab('dms')
  }, [relationship?.sourceAgentId, relationship?.targetAgentId, isOpen])

  // Build public-feed interactions (posts by either agent where the other also appears)
  const interactions = useMemo(() => {
    if (!relationship) return []
    const { sourceAgentId: a, targetAgentId: b } = relationship
    const result: Array<{ post: DiscussionPost; comments: DiscussionPost['comments'] }> = []

    for (const post of discussionFeed) {
      const byA = post.agentId === a
      const byB = post.agentId === b
      if (!byA && !byB) continue
      const comments = post.comments.filter(c => c.agentId === a || c.agentId === b)
      result.push({ post, comments })
    }

    return result.sort(
      (x, y) => new Date(x.post.created_at).getTime() - new Date(y.post.created_at).getTime()
    )
  }, [relationship, discussionFeed])

  if (!isOpen || !relationship) return null

  const { sourceAgentId: src, targetAgentId: tgt, type, strength, narrative } = relationship
  const color = REL_COLORS[type] ?? '#888'
  const strengthPct = Math.round(strength * 100)

  const srcState = nodeStates[src]
  const tgtState = nodeStates[tgt]
  const srcColor = srcState ? (stateColors[srcState] ?? '#888') : '#888'
  const tgtColor = tgtState ? (stateColors[tgtState] ?? '#888') : '#888'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1099,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1100,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        width: '92%', maxWidth: 660, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Relationship
            </span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 6 }}
            >
              ✕
            </button>
          </div>

          {/* Agent A ──── type ──▶ Agent B */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            background: `${color}12`,
            borderRadius: 10,
            border: `1px solid ${color}35`,
            marginBottom: 14,
          }}>
            <AgentPill id={src} state={srcState} stateColor={srcColor} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 2, background: color, opacity: 0.7, borderRadius: 1 }} />
              <span style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                {type.replace('_', '\u00a0')}
              </span>
              <div style={{ flex: 1, height: 2, background: color, opacity: 0.7, borderRadius: 1 }} />
              <span style={{ color, fontSize: 12 }}>▶</span>
            </div>
            <AgentPill id={tgt} state={tgtState} stateColor={tgtColor} />
          </div>

          {/* Strength + narrative */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 110, padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Strength</div>
              <div style={{ fontWeight: 700, fontSize: 15, color }}>{strengthPct}%</div>
              <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${strengthPct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
              </div>
            </div>
            {narrative && (
              <div style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Reason</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                  "{narrative}"
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {([
            { key: 'dms', label: 'Direct Messages', count: dms.length },
            { key: 'feed', label: 'Public Feed', count: interactions.length },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? `2px solid ${color}` : '2px solid transparent',
                color: activeTab === tab.key ? color : 'var(--text-muted)',
                fontWeight: activeTab === tab.key ? 700 : 400,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.04em',
              }}
            >
              {tab.label}
              <span style={{
                marginLeft: 6,
                fontSize: 10,
                background: activeTab === tab.key ? `${color}25` : 'var(--bg-surface)',
                color: activeTab === tab.key ? color : 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: 10,
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {activeTab === 'dms' && (
            dmLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                Loading messages...
              </div>
            ) : dms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                No direct messages between these agents yet.
                <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>
                  DMs appear when agents with strong relationships reach out privately.
                </div>
              </div>
            ) : (
              dms.map(dm => {
                const bySrc = dm.fromAgentId === src
                return (
                  <Bubble
                    key={dm.id}
                    author={dm.fromAuthor}
                    content={dm.content}
                    time={dm.createdAt}
                    isLeft={bySrc}
                    accentColor={bySrc ? color : 'var(--text-secondary)'}
                    isBySrc={bySrc}
                    relColor={color}
                    isDM
                  />
                )
              })
            )
          )}

          {activeTab === 'feed' && (
            interactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                No posts or comments exchanged between these agents yet.
              </div>
            ) : (
              interactions.map(({ post, comments }) => {
                const postBySrc = post.agentId === src
                return (
                  <div key={post.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Bubble
                      author={post.author}
                      content={post.content}
                      time={post.created_at}
                      tags={post.tags}
                      isLeft={postBySrc}
                      accentColor={postBySrc ? color : 'var(--text-secondary)'}
                      isBySrc={postBySrc}
                      relColor={color}
                    />
                    {comments.map(comment => {
                      const commentBySrc = comment.agentId === src
                      return (
                        <div key={comment.id} style={{ marginLeft: commentBySrc ? 20 : 0, marginRight: commentBySrc ? 0 : 20 }}>
                          <Bubble
                            author={`↩ ${comment.author}`}
                            content={comment.message}
                            time={comment.created_at}
                            isLeft={commentBySrc}
                            accentColor={commentBySrc ? color : 'var(--text-secondary)'}
                            isBySrc={commentBySrc}
                            relColor={color}
                            isReply
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function AgentPill({ id, state, stateColor }: { id: string; state?: string; stateColor: string }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '6px 12px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      minWidth: 80,
    }}>
      <span style={{ fontWeight: 700, fontSize: 13 }}>Agent {id}</span>
      {state && (
        <span style={{ fontSize: 9, fontWeight: 600, color: stateColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {state}
        </span>
      )}
    </div>
  )
}

interface BubbleProps {
  author: string
  content: string
  time: string
  tags?: string[]
  isLeft: boolean
  accentColor: string
  isBySrc: boolean
  relColor: string
  isReply?: boolean
  isDM?: boolean
}

function Bubble({ author, content, time, tags, isLeft, accentColor, isBySrc, relColor, isReply, isDM }: BubbleProps) {
  const bg = isBySrc ? `${relColor}12` : 'rgba(255,255,255,0.04)'
  const border = isBySrc ? `1px solid ${relColor}30` : '1px solid var(--border)'
  const radius = isReply
    ? (isLeft ? '3px 10px 10px 10px' : '10px 3px 10px 10px')
    : (isLeft ? '4px 14px 14px 14px' : '14px 4px 14px 14px')

  const timeStr = (() => {
    try { return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
  })()

  return (
    <div style={{
      alignSelf: isLeft ? 'flex-start' : 'flex-end',
      maxWidth: '80%',
      background: bg,
      border,
      borderRadius: radius,
      padding: isReply ? '7px 12px' : '10px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        {isDM && (
          <span style={{ fontSize: 9, opacity: 0.5, marginRight: 2 }}>✉</span>
        )}
        <span style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {author}
        </span>
        {timeStr && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>{timeStr}</span>
        )}
      </div>
      {tags && tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {tags.map(t => (
            <span key={t} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}>
              {t}
            </span>
          ))}
        </div>
      )}
      <div style={{ fontSize: isReply ? 12 : 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
        {content}
      </div>
    </div>
  )
}
