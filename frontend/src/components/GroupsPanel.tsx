import { useState, useEffect, useCallback } from 'react'
import type { AgentGroup, GroupMessage } from '../types/simulation'

interface GroupsPanelProps {
  simId: string
  groups: AgentGroup[]
  fetchGroupMessages: (groupId: string) => Promise<GroupMessage[]>
  nodeStates?: Record<string, string>
  stateColors?: Record<string, string>
}

export default function GroupsPanel({
  simId,
  groups,
  fetchGroupMessages,
  nodeStates = {},
  stateColors = {},
}: GroupsPanelProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? null

  const loadMessages = useCallback(async (groupId: string) => {
    setLoadingMsgs(true)
    try {
      const msgs = await fetchGroupMessages(groupId)
      setMessages(msgs)
    } finally {
      setLoadingMsgs(false)
    }
  }, [fetchGroupMessages])

  useEffect(() => {
    if (!selectedGroupId) return
    loadMessages(selectedGroupId)
  }, [selectedGroupId, loadMessages])

  // Refresh messages when groups update (new message may have arrived)
  useEffect(() => {
    if (selectedGroupId) {
      loadMessages(selectedGroupId)
    }
  }, [groups, selectedGroupId, loadMessages])

  if (groups.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No groups formed yet.
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>
          Agents with shared beliefs automatically form groups as the simulation runs.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Group list */}
      <div style={{
        width: 180,
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        flexShrink: 0,
      }}>
        {groups.map(group => {
          const isSelected = group.id === selectedGroupId
          const beliefColor = group.sharedBelief
            ? (stateColors[group.sharedBelief] ?? '#888')
            : '#888'

          return (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                background: isSelected ? `${beliefColor}18` : 'none',
                border: 'none',
                borderLeft: isSelected ? `3px solid ${beliefColor}` : '3px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: isSelected ? beliefColor : 'var(--text-primary)',
                marginBottom: 3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {group.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                }}>
                  {group.memberIds.length} member{group.memberIds.length !== 1 ? 's' : ''}
                </span>
                {group.sharedBelief && (
                  <span style={{
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: `${beliefColor}25`,
                    color: beliefColor,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {group.sharedBelief}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedGroup ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Select a group to view its chat
          </div>
        ) : (
          <>
            {/* Group header */}
            <div style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                {selectedGroup.name}
              </div>
              {selectedGroup.description && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {selectedGroup.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedGroup.memberIds.map(id => {
                  const state = nodeStates[id]
                  const color = state ? (stateColors[state] ?? '#888') : '#888'
                  return (
                    <span key={id} style={{
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: `${color}18`,
                      border: `1px solid ${color}30`,
                      color,
                      fontWeight: 600,
                    }}>
                      Agent {id}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loadingMsgs ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
                  Loading...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
                  No messages yet.
                </div>
              ) : (
                messages.map(msg => {
                  const state = nodeStates[msg.authorId]
                  const color = state ? (stateColors[state] ?? '#888') : '#888'
                  const timeStr = (() => {
                    try { return new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
                  })()

                  return (
                    <div key={msg.id} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}>
                          {msg.author}
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                          Agent {msg.authorId}
                        </span>
                        {timeStr && (
                          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            {timeStr}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        lineHeight: 1.55,
                        padding: '8px 10px',
                        background: `${color}0d`,
                        border: `1px solid ${color}22`,
                        borderRadius: '4px 12px 12px 12px',
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
