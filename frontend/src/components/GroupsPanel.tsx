import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
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
  const [creating, setCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

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

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) { toast.error('Group name is required'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/simulations/${simId}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim(), initialMembers: selectedMembers }),
      })
      if (!res.ok) throw new Error('Failed to create group')
      toast.success(`Group "${newGroupName.trim()}" created`)
      setCreating(false)
      setNewGroupName('')
      setSelectedMembers([])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create group')
    } finally {
      setSubmitting(false)
    }
  }

  const agentIds = Object.keys(nodeStates)

  const creationForm = creating && (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'var(--bg-card)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>New Group</span>
        <button className="btn-icon" onClick={() => { setCreating(false); setNewGroupName(''); setSelectedMembers([]) }} style={{ fontSize: 12 }}>✕</button>
      </div>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <input
          type="text"
          placeholder="Group name…"
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          autoFocus
          style={{
            width: '100%', padding: '7px 10px', fontSize: 12,
            borderRadius: 6, border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
          Select members ({selectedMembers.length} selected)
        </div>
        {agentIds.slice(0, 200).map(id => {
          const st = nodeStates[id]
          const color = st ? (stateColors[st] ?? '#888') : '#888'
          const checked = selectedMembers.includes(id)
          return (
            <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={checked} onChange={() => toggleMember(id)} style={{ accentColor: 'var(--accent)' }} />
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>Agent {id}</span>
              {st && <span style={{ fontSize: 10, color, marginLeft: 'auto' }}>{st}</span>}
            </label>
          )
        })}
        {agentIds.length > 200 && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
            Showing first 200 of {agentIds.length} agents
          </div>
        )}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
        <button
          className="btn-primary"
          onClick={handleCreateGroup}
          disabled={submitting || !newGroupName.trim()}
          style={{ width: '100%', fontSize: 12, padding: '8px' }}
        >
          {submitting ? 'Creating…' : 'Create Group'}
        </button>
      </div>
    </div>
  )

  if (groups.length === 0 && !creating) {
    return (
      <div style={{ position: 'relative', height: '100%' }}>
        {creationForm}
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ marginBottom: 12 }}>No groups formed yet.</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 16 }}>
            Agents with shared beliefs automatically form groups as the simulation runs.
          </div>
          <button className="btn-secondary" onClick={() => setCreating(true)} style={{ fontSize: 12, padding: '6px 16px' }}>
            ＋ New Group
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {creationForm}
      {/* Group list */}
      <div style={{
        width: 180,
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <button
          onClick={() => setCreating(true)}
          style={{
            margin: '8px', padding: '6px 10px', fontSize: 11, fontWeight: 700,
            borderRadius: 6, border: '1px dashed var(--border)',
            background: 'transparent', color: 'var(--accent)', cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ＋ New Group
        </button>
        <div style={{ flex: 1, overflowY: 'auto' }}>
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
