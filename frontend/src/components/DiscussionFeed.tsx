import { useState, useRef, useEffect, useCallback } from 'react'
import type { DiscussionPost } from '../types/simulation'

const PAGE_SIZE = 50

interface Personality {
  name: string
  color: string
}

interface Props {
  posts: DiscussionPost[]
  personalities: Personality[]
  onLike: (postId: string) => void
  onComment: (postId: string, author: string, message: string) => void
  onOpenAgent?: (agentId: string) => void
}

export default function DiscussionFeed({ posts, personalities, onLike, onComment, onOpenAgent }: Props) {
  const [expandedCommentInput, setExpandedCommentInput] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('')
  const [tagFilter, setTagFilter] = useState<'all' | 'news' | 'discussion'>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset visible count when posts list changes significantly (new simulation, filter change)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    if (listRef.current) listRef.current.scrollTop = 0
  }, [posts.length === 0])

  // Auto-load more when user scrolls near the bottom
  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      setVisibleCount(v => v + PAGE_SIZE)
    }
  }, [])

  const getPersonalityColor = (personalityName?: string): string => {
    if (!personalityName) return 'var(--text-secondary)'
    const match = personalities.find(p => p.name.toLowerCase() === personalityName.toLowerCase())
    return match?.color || 'var(--text-secondary)'
  }

  const normalizeTag = (tag: string): 'news' | 'discussion' | 'other' => {
    const normalized = tag.toLowerCase().trim()
    if (normalized === 'news') return 'news'
    if (normalized === 'discussion') return 'discussion'
    return 'other'
  }

  const shouldShowPost = (post: DiscussionPost): boolean => {
    if (tagFilter === 'all') return true
    if (!post.tags || post.tags.length === 0) return false
    return post.tags.some(tag => normalizeTag(tag) === tagFilter)
  }

  const filteredPosts = posts.filter(shouldShowPost)
  const visiblePosts = filteredPosts.slice(0, visibleCount)
  const hasMore = visibleCount < filteredPosts.length

  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return 'unknown'
    }
  }

  const handleSubmitComment = (postId: string) => {
    const author = commentAuthor.trim() || 'Guest'
    const message = commentText.trim()
    
    if (!message) return

    onComment(postId, author, message)
    setCommentText('')
    setCommentAuthor('')
    setExpandedCommentInput(null)
  }

  if (posts.length === 0) {
    return (
      <div
        data-testid="discussion-feed"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <span className="label" style={{ margin: 0 }}>TOPIC COMMUNITY</span>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
            textAlign: 'center',
            paddingBottom: 24,
          }}
        >
          No discussion posts yet. Check back soon!
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="discussion-feed"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <span className="label" style={{ margin: 0 }}>TOPIC COMMUNITY</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({filteredPosts.length})</span>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Filter:</span>
          {(['all', 'news', 'discussion'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setTagFilter(filter)}
              style={{
                background: tagFilter === filter ? 'rgba(124, 109, 250, 0.3)' : 'transparent',
                border: `1px solid ${tagFilter === filter ? 'var(--accent)' : 'var(--border)'}`,
                color: tagFilter === filter ? 'var(--accent)' : 'var(--text-secondary)',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (tagFilter !== filter) {
                  e.currentTarget.style.background = 'rgba(124, 109, 250, 0.1)'
                  e.currentTarget.style.borderColor = 'rgba(124, 109, 250, 0.3)'
                }
              }}
              onMouseLeave={e => {
                if (tagFilter !== filter) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }
              }}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingRight: 4,
        }}
      >
        {filteredPosts.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            No posts match this filter
          </div>
        ) : (
          visiblePosts.map(post => {
            const personalityColor = getPersonalityColor(post.personality)
            const lastTwoComments = post.comments.slice(-2)

            return (
              <div
                key={post.id}
                data-testid="discussion-post"
                className="glass glass-hover"
                style={{
                  padding: 12,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  {post.agentId && onOpenAgent ? (
                    <button
                      onClick={() => onOpenAgent(post.agentId!)}
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: 'var(--accent)',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-glow)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent)')}
                    >
                      {post.author}
                    </button>
                  ) : (
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                      {post.author}
                    </span>
                  )}

                  {post.personality && (
                    post.agentId && onOpenAgent ? (
                      <button
                        onClick={() => onOpenAgent(post.agentId!)}
                        className="badge badge-simple"
                        style={{
                          background: `rgba(${hexToRgb(personalityColor)}, 0.15)`,
                          color: personalityColor,
                          fontSize: 10,
                          border: 'none',
                          padding: '2px 8px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        {post.personality}
                      </button>
                    ) : (
                      <span
                        className="badge badge-simple"
                        style={{
                          background: `rgba(${hexToRgb(personalityColor)}, 0.15)`,
                          color: personalityColor,
                          fontSize: 10,
                        }}
                      >
                        {post.personality}
                      </span>
                    )
                  )}

                  {post.tags && post.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                       {post.tags.map((tag, idx) => {
                         const normalized = normalizeTag(tag)
                         const tagColor = normalized === 'news' ? 'rgba(34, 197, 94, 0.15)' : 
                                        normalized === 'discussion' ? 'rgba(0, 168, 181, 0.15)' : 
                                        'rgba(122, 156, 200, 0.1)'
                         const tagTextColor = normalized === 'news' ? '#22c55e' : 
                                            normalized === 'discussion' ? '#00a8b5' : 
                                            'var(--text-secondary)'
                        return (
                          <span
                            key={idx}
                            style={{
                              background: tagColor,
                              color: tagTextColor,
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 10,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                            }}
                          >
                            {tag}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {formatTime(post.created_at)}
                  </span>
                </div>

                <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {post.content}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: lastTwoComments.length > 0 ? 10 : 0,
                    fontSize: 12,
                  }}
                >
                  <button
                    onClick={() => onLike(post.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent2)',
                      cursor: 'pointer',
                      padding: '4px 0',
                      fontSize: 12,
                      fontWeight: 500,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent2-glow)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent2)')}
                  >
                    👍 Like ({post.likes})
                  </button>

                  <button
                    onClick={() => setExpandedCommentInput(expandedCommentInput === post.id ? null : post.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      padding: '4px 0',
                      fontSize: 12,
                      fontWeight: 500,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-glow)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent)')}
                  >
                    💬 Comment ({post.comments.length})
                  </button>
                </div>

                {lastTwoComments.length > 0 && (
                   <div
                     style={{
                       background: 'rgba(0, 168, 181, 0.05)',
                       borderLeft: '2px solid var(--border)',
                       padding: '8px 10px',
                       borderRadius: 6,
                       marginBottom: expandedCommentInput === post.id ? 10 : 0,
                       fontSize: 12,
                     }}
                   >
                    {lastTwoComments.map(comment => (
                       <div
                         key={comment.id}
                         style={{
                           marginBottom: comment === lastTwoComments[lastTwoComments.length - 1] ? 0 : 8,
                         }}
                       >
                         <div style={{ display: 'flex', gap: 6, marginBottom: 2, alignItems: 'center' }}>
                           {comment.agentId && onOpenAgent ? (
                             <button
                               onClick={() => onOpenAgent(comment.agentId!)}
                               style={{
                                 fontWeight: 600,
                                 color: 'var(--accent)',
                                 fontSize: 11,
                                 background: 'transparent',
                                 border: 'none',
                                 padding: 0,
                                 cursor: 'pointer',
                                 transition: 'color 0.15s',
                               }}
                               onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-glow)')}
                               onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent)')}
                             >
                               {comment.author}
                             </button>
                           ) : (
                             <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11 }}>
                               {comment.author}
                             </span>
                           )}
                           <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                             {formatTime(comment.created_at)}
                           </span>
                         </div>
                         <div style={{ color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.4 }}>
                           {comment.message}
                         </div>
                       </div>
                    ))}
                  </div>
                )}

                {expandedCommentInput === post.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Your name (optional)"
                      value={commentAuthor}
                      onChange={e => setCommentAuthor(e.target.value)}
                      style={{
                        fontSize: 12,
                        padding: '8px 12px',
                      }}
                    />
                    <textarea
                      className="input"
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      style={{
                        fontSize: 12,
                        padding: '8px 12px',
                        minHeight: 60,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleSubmitComment(post.id)}
                        className="btn-primary"
                        style={{
                          flex: 1,
                          padding: '8px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => setExpandedCommentInput(null)}
                        className="btn-secondary"
                        style={{
                          flex: 1,
                          padding: '8px 14px',
                          fontSize: 12,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}

        {hasMore && (
          <button
            onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
            style={{
              flexShrink: 0,
              padding: '8px',
              fontSize: 11,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Show {Math.min(PAGE_SIZE, filteredPosts.length - visibleCount)} more of {filteredPosts.length - visibleCount} remaining
          </button>
        )}
      </div>
    </div>
  )
}

function hexToRgb(hex: string): string {
  if (hex.includes('var(')) {
    const colorMap: Record<string, string> = {
      'var(--accent)': '124, 109, 250',
      'var(--accent2)': '0, 212, 232',
      'var(--accent3)': '192, 132, 252',
      'var(--success)': '34, 197, 94',
      'var(--warning)': '245, 158, 11',
      'var(--danger)': '239, 68, 68',
      'var(--text-secondary)': '122, 156, 200',
    }
    return colorMap[hex] || '122, 156, 200'
  }

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)].join(', ')
  }
  return '122, 156, 200'
}
