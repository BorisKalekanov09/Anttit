import React, { useState } from 'react';
import type { AgentProfile, DiscussionPost } from '../types/simulation';

export interface TimelineEntry {
  timestamp: string;
  event: string;
  type: 'state_change' | 'belief_update' | 'action' | 'comment';
}

export interface AgentDetailDrawerProps {
  agentId: string | null;
  profile: AgentProfile | null;
  timeline: TimelineEntry[];
  isLoading: boolean;
  timelineHasMore: boolean;
  onLoadMoreTimeline: () => Promise<void>;
  onLikeProfile: () => Promise<void>;
  onClose: () => void;
  isLiking?: boolean;
  hasLiked?: boolean;
  feedPosts?: DiscussionPost[];
  onLikePost?: (postId: string) => Promise<void>;
  onCommentPost?: (postId: string, message: string) => Promise<void>;
  onShowCausalChain?: (agentId: string) => Promise<void>;
}

const AgentDetailDrawer: React.FC<AgentDetailDrawerProps> = ({
  agentId,
  profile,
  timeline,
  isLoading,
  timelineHasMore,
  onLoadMoreTimeline,
  onLikeProfile,
  onClose,
  isLiking = false,
  hasLiked = false,
  feedPosts = [],
  onLikePost,
  onCommentPost,
  onShowCausalChain,
}) => {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentMessage, setCommentMessage] = useState('');
  const [isActingOnPost, setIsActingOnPost] = useState(false);

  // Return null if no agent is selected (drawer hidden)
  if (!agentId) {
    return null;
  }

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await onLoadMoreTimeline();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLike = async () => {
    try {
      await onLikeProfile();
    } catch (error) {
      console.error('Failed to like profile:', error);
    }
  };

  const handleLikePost = async () => {
    if (!selectedPostId || !onLikePost) return;
    setIsActingOnPost(true);
    try {
      await onLikePost(selectedPostId);
      setSelectedPostId(null);
    } catch (error) {
      console.error('Failed to like post:', error);
    } finally {
      setIsActingOnPost(false);
    }
  };

  const handleCommentPost = async () => {
    if (!selectedPostId || !onCommentPost || !commentMessage.trim()) return;
    setIsActingOnPost(true);
    try {
      await onCommentPost(selectedPostId, commentMessage.trim());
      setCommentMessage('');
      setSelectedPostId(null);
    } catch (error) {
      console.error('Failed to comment on post:', error);
    } finally {
      setIsActingOnPost(false);
    }
  };

  return (
    <div className="agent-detail-drawer">
      {/* Backdrop overlay */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* Main drawer panel */}
      <div className="drawer-panel">
        {/* Header with close button */}
        <div className="drawer-header">
          <div className="header-content">
           {isLoading ? (
               <h2>Loading...</h2>
             ) : profile ? (
               <>
                 <h2>{profile.personality}</h2>
                 <p className="agent-role">{profile.role}</p>
               </>
             ) : (
               <h2>Agent Not Found</h2>
             )}
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="drawer-content">
          {isLoading ? (
            <p className="loading-text">Loading agent details...</p>
          ) : !profile ? (
            <p className="error-text">Could not load agent profile</p>
          ) : (
            <>
              {/* Profile Like Button */}
               <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                 <button
                   className="like-button"
                   onClick={handleLike}
                   disabled={hasLiked || isLiking}
                   aria-label={hasLiked ? 'Already liked' : 'Like profile'}
                   style={{ flex: 1 }}
                 >
                   <span className="heart-emoji">❤️</span>
                   <span className="like-count">{profile.profileLikes}</span>
                   <span className="like-text">{hasLiked ? 'Liked' : 'Like'}</span>
                 </button>
                 {onShowCausalChain && agentId && (
                   <button
                     onClick={() => onShowCausalChain(agentId)}
                     style={{
                       flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                       background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                       color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap',
                     }}
                     title="Show causal chain — why did this agent change?"
                   >
                     🔍 Why changed?
                   </button>
                 )}
               </div>

              {/* Beliefs Section */}
              <section className="beliefs-section">
                <h3>Beliefs</h3>
                {profile.beliefs && profile.beliefs.length > 0 ? (
                  <div className="beliefs-list">
                    {profile.beliefs.map((belief, index) => (
                      <div key={index} className="belief-item">
                        <div className="belief-header">
                          <span className="belief-topic">{belief.topic}</span>
                          <span className="belief-weight">
                            {Math.round(belief.weight * 100)}%
                          </span>
                        </div>
                        <div className="belief-bar">
                          <div
                            className="belief-fill"
                            style={{
                              width: `${belief.weight * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No beliefs recorded</p>
                )}
              </section>

              {/* Timeline Section */}
              <section className="timeline-section">
                <h3>Timeline</h3>
                {timeline && timeline.length > 0 ? (
                  <div className="timeline-list">
                    {timeline.map((entry, index) => (
                      <div key={index} className="timeline-entry">
                        <div className="timeline-marker" />
                        <div className="timeline-content">
                          <p className="timeline-event">{entry.event}</p>
                          <p className="timeline-timestamp">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {timelineHasMore && (
                      <button
                        className="load-more-button"
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                      >
                        {isLoadingMore ? 'Loading...' : 'Load More'}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="empty-state">No timeline events</p>
                )}
              </section>

              {/* Manual Actions Section */}
              <section className="manual-actions-section">
                <h3>Manual Actions</h3>
                {feedPosts && feedPosts.length > 0 ? (
                  <div className="manual-actions-content">
                    <div className="post-selection">
                      <label htmlFor="post-select" className="select-label">
                        Select a post:
                      </label>
                      <select
                        id="post-select"
                        value={selectedPostId || ''}
                        onChange={(e) => setSelectedPostId(e.target.value || null)}
                        className="post-dropdown"
                      >
                        <option value="">-- Choose a post --</option>
                        {feedPosts.map((post) => (
                          <option key={post.id} value={post.id}>
                            {post.author}: {post.content.substring(0, 40)}
                            {post.content.length > 40 ? '...' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedPostId && (
                      <div className="action-controls">
                        <button
                          className="action-button action-like"
                          onClick={handleLikePost}
                          disabled={isActingOnPost || !onLikePost}
                          aria-label="Like selected post"
                        >
                          {isActingOnPost ? '...' : '👍 Like'}
                        </button>

                        <div className="comment-input-group">
                          <textarea
                            className="comment-input"
                            placeholder="Write a comment..."
                            value={commentMessage}
                            onChange={(e) => setCommentMessage(e.target.value)}
                            disabled={isActingOnPost}
                            rows={2}
                          />
                          <button
                            className="action-button action-comment"
                            onClick={handleCommentPost}
                            disabled={
                              isActingOnPost || !onCommentPost || !commentMessage.trim()
                            }
                            aria-label="Comment on selected post"
                          >
                            {isActingOnPost ? '...' : '💬 Comment'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="empty-state-manual">
                    No posts available. Check back when the feed has content.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Scoped CSS Styles */}
      <style>{`
        .agent-detail-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
          pointer-events: none;
        }

        .drawer-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(2px);
          pointer-events: auto;
          transition: opacity 0.2s ease;
        }

        .drawer-panel {
          display: flex;
          flex-direction: column;
          width: min(100%, 420px);
          height: 100%;
          background-color: var(--bg-card, #1a1a1a);
          border-left: 1px solid var(--border, #444);
          pointer-events: auto;
          box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
          animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .drawer-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1rem;
          border-bottom: 1px solid var(--border, #444);
          flex-shrink: 0;
        }

        .header-content h2 {
          margin: 0 0 0.25rem 0;
          font-size: 1.25rem;
          color: var(--text-primary, #fff);
          font-weight: 600;
        }

        .agent-role {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-secondary, #999);
          text-transform: capitalize;
        }

        .close-button {
          background: none;
          border: none;
          color: var(--text-secondary, #999);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .close-button:hover {
          background-color: rgba(255, 255, 255, 0.1);
          color: var(--text-primary, #fff);
        }

        .drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .drawer-content::-webkit-scrollbar {
          width: 6px;
        }

        .drawer-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .drawer-content::-webkit-scrollbar-thumb {
          background-color: var(--border, #444);
          border-radius: 3px;
        }

        .drawer-content::-webkit-scrollbar-thumb:hover {
          background-color: var(--text-secondary, #999);
        }

        .loading-text,
        .error-text {
          color: var(--text-secondary, #999);
          font-size: 0.875rem;
          text-align: center;
          padding: 2rem 1rem;
        }

        .error-text {
          color: #e74c3c;
        }

        .like-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: rgba(52, 152, 219, 0.15);
          border: 1px solid rgba(52, 152, 219, 0.3);
          color: var(--text-primary, #fff);
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .like-button:hover:not(:disabled) {
          background-color: rgba(52, 152, 219, 0.25);
          border-color: rgba(52, 152, 219, 0.5);
        }

        .like-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .heart-emoji {
          font-size: 1.1rem;
        }

        .like-count {
          min-width: 1.5rem;
          text-align: center;
          font-weight: 600;
        }

        .like-text {
          flex: 1;
          text-align: left;
        }

        .beliefs-section,
        .timeline-section,
        .manual-actions-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .beliefs-section h3,
        .timeline-section h3,
        .manual-actions-section h3 {
          margin: 0;
          font-size: 1rem;
          color: var(--text-primary, #fff);
          font-weight: 600;
        }

        .beliefs-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .belief-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.75rem;
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border, #444);
          border-radius: 6px;
        }

        .belief-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .belief-topic {
          color: var(--text-primary, #fff);
          font-size: 0.875rem;
          font-weight: 500;
        }

        .belief-weight {
          color: var(--text-secondary, #999);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .belief-bar {
          height: 6px;
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .belief-fill {
          height: 100%;
          background: linear-gradient(90deg, #3498db, #2980b9);
          border-radius: 3px;
          transition: width 0.2s ease;
        }

        .timeline-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .timeline-entry {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem;
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border, #444);
          border-radius: 6px;
          position: relative;
        }

        .timeline-marker {
          width: 8px;
          height: 8px;
          background-color: #3498db;
          border-radius: 50%;
          margin-top: 0.5rem;
          flex-shrink: 0;
        }

        .timeline-content {
          flex: 1;
          min-width: 0;
        }

        .timeline-event {
          margin: 0;
          color: var(--text-primary, #fff);
          font-size: 0.875rem;
          word-break: break-word;
        }

        .timeline-timestamp {
          margin: 0.25rem 0 0 0;
          color: var(--text-secondary, #999);
          font-size: 0.75rem;
        }

        .load-more-button {
          width: 100%;
          padding: 0.75rem;
          margin-top: 0.5rem;
          background-color: rgba(52, 152, 219, 0.1);
          border: 1px solid rgba(52, 152, 219, 0.3);
          color: #3498db;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .load-more-button:hover:not(:disabled) {
          background-color: rgba(52, 152, 219, 0.2);
          border-color: rgba(52, 152, 219, 0.5);
        }

        .load-more-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .manual-actions-content {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .post-selection {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .select-label {
          font-size: 0.8rem;
          color: var(--text-secondary, #999);
          font-weight: 500;
        }

        .post-dropdown {
          padding: 0.625rem;
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border, #444);
          color: var(--text-primary, #fff);
          border-radius: 6px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .post-dropdown:hover:not(:disabled) {
          background-color: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .post-dropdown:focus {
          outline: none;
          border-color: #3498db;
          box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
        }

        .post-dropdown:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-controls {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.75rem;
          background-color: rgba(52, 152, 219, 0.08);
          border: 1px solid rgba(52, 152, 219, 0.2);
          border-radius: 6px;
        }

        .action-button {
          padding: 0.625rem 0.75rem;
          background-color: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--border, #444);
          color: var(--text-primary, #fff);
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .action-button:hover:not(:disabled) {
          background-color: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-like {
          background-color: rgba(52, 152, 219, 0.15);
          border-color: rgba(52, 152, 219, 0.3);
          color: #3498db;
        }

        .action-like:hover:not(:disabled) {
          background-color: rgba(52, 152, 219, 0.25);
          border-color: rgba(52, 152, 219, 0.5);
        }

        .action-comment {
          background-color: rgba(155, 89, 182, 0.15);
          border-color: rgba(155, 89, 182, 0.3);
          color: #9b59b6;
        }

        .action-comment:hover:not(:disabled) {
          background-color: rgba(155, 89, 182, 0.25);
          border-color: rgba(155, 89, 182, 0.5);
        }

        .comment-input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .comment-input {
          padding: 0.625rem;
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border, #444);
          color: var(--text-primary, #fff);
          border-radius: 6px;
          font-size: 0.85rem;
          font-family: inherit;
          resize: vertical;
          transition: all 0.2s ease;
        }

        .comment-input:focus {
          outline: none;
          border-color: #9b59b6;
          box-shadow: 0 0 0 2px rgba(155, 89, 182, 0.2);
          background-color: rgba(255, 255, 255, 0.08);
        }

        .comment-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .empty-state-manual {
          margin: 0;
          padding: 1rem;
          text-align: center;
          color: var(--text-secondary, #999);
          font-size: 0.875rem;
          background-color: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
        }

        .empty-state {
          margin: 0;
          padding: 1rem;
          text-align: center;
          color: var(--text-secondary, #999);
          font-size: 0.875rem;
          background-color: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
        }

        @media (max-width: 768px) {
          .drawer-panel {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentDetailDrawer;
