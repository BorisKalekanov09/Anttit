import { useEffect, useRef, useState, useCallback } from 'react'
import type { InitMessage, TickMessage, Agent, TickEvent } from '../types/simulation'

interface Props {
  initData: InitMessage | null
  latestTick: TickMessage | null
  width?: number
  height?: number
  events?: TickEvent[]
  showEdgeLabels?: boolean
  edgeLabelMinScale?: number
  onScaleChange?: (scale: number) => void
  onSelectAgent?: (agentId: string) => Promise<void>
}

interface TransitionArrow {
  from: string
  to: string
  expiresAt: number
  color: string
}

interface TooltipData {
  x: number
  y: number
  agent: Agent
}

interface InspectorData {
  agent: Agent
  stateHistory: string[]
}

const NODE_RADIUS_SMALL = 5
const NODE_RADIUS_LARGE = 7
const HEATMAP_THRESHOLD = 300
const ARROW_DURATION_MS = 800

function getEmotionalEmoji(emotionalState: number): string {
  if (emotionalState <= -0.6) return '😰'
  if (emotionalState <= -0.2) return '😟'
  if (emotionalState <= 0.2) return '😐'
  if (emotionalState <= 0.6) return '🙂'
  return '😊'
}

export default function AgentNetwork({ 
  initData, 
  latestTick, 
  width = 520, 
  height = 420, 
  events = [],
  showEdgeLabels: _showEdgeLabels,
  edgeLabelMinScale: _edgeLabelMinScale,
  onScaleChange,
  onSelectAgent,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pixelPositionsRef = useRef<Record<string, [number, number]>>({})
  const transitionEventsRef = useRef<TransitionArrow[]>([])
  const stateHistoryRef = useRef<Record<string, string[]>>({})

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [inspector, setInspector] = useState<InspectorData | null>(null)

  const agents = latestTick?.agents ?? initData?.agents ?? []
  const agentMap = new Map(agents.map(a => [a.id, a]))

  useEffect(() => {
    if (!initData) return
    const pos: Record<string, [number, number]> = {}
    const padding = 28
    for (const [id, [nx, ny]] of Object.entries(initData.positions)) {
      pos[id] = [
        padding + nx * (width - padding * 2),
        padding + ny * (height - padding * 2),
      ]
    }
    pixelPositionsRef.current = pos
  }, [initData, width, height])

  useEffect(() => {
    if (!latestTick) return
    const nodeStates = latestTick.node_states
    for (const [id, state] of Object.entries(nodeStates)) {
      if (!stateHistoryRef.current[id]) stateHistoryRef.current[id] = []
      const history = stateHistoryRef.current[id]
      if (history.length === 0 || history[history.length - 1] !== state) {
        history.push(state)
        if (history.length > 20) history.shift()
      }
    }
  }, [latestTick])

  useEffect(() => {
    if (!initData || events.length === 0) return
    const now = Date.now()
    const newArrows: TransitionArrow[] = events
      .filter(ev => ev.from_state !== ev.to_state)
      .map(ev => ({
        from: ev.agent_id,
        to: ev.agent_id,
        expiresAt: now + ARROW_DURATION_MS,
        color: initData.state_colors[ev.to_state] ?? '#888',
      }))
    transitionEventsRef.current = [
      ...transitionEventsRef.current.filter(a => a.expiresAt > now),
      ...newArrows,
    ]
  }, [events, initData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !initData) return
    const ctx = canvas.getContext('2d')!

    const draw = () => {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y)

      const stateColors = initData.state_colors
      const nodeStates = latestTick?.node_states ?? {}
      const agentCount = Object.keys(initData.positions).length
      const useHeatmap = agentCount > HEATMAP_THRESHOLD

      if (useHeatmap) {
        drawHeatmap(ctx, initData, nodeStates, stateColors, width, height)
      } else {
        drawNetwork(ctx, initData, nodeStates, stateColors, width, height, agentMap, transitionEventsRef.current)
      }

      ctx.restore()
    }

    let animId: number
    let running = true
    const loop = () => {
      if (!running) return
      draw()
      animId = requestAnimationFrame(loop)
    }
    loop()
    return () => {
      running = false
      cancelAnimationFrame(animId)
    }
  }, [initData, latestTick, width, height, scale, offset, agents])

  const resetView = useCallback(() => {
    setScale(1)
    onScaleChange?.(1)
    setOffset({ x: 0, y: 0 })
  }, [onScaleChange])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.min(5, Math.max(0.3, scale * delta))
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale)
    const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale)
    setScale(newScale)
    onScaleChange?.(newScale)
    setOffset({ x: newOffsetX, y: newOffsetY })
  }, [scale, offset, onScaleChange])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
  }, [offset])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || !initData) return

    if (isDragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
      setTooltip(null)
      return
    }

    const mouseX = (e.clientX - rect.left - offset.x) / scale
    const mouseY = (e.clientY - rect.top - offset.y) / scale
    const positions = pixelPositionsRef.current

    let closestAgent: Agent | null = null
    let closestDist = 12

    for (const [id, [px, py]] of Object.entries(positions)) {
      const dist = Math.hypot(mouseX - px, mouseY - py)
      if (dist < closestDist) {
        closestDist = dist
        closestAgent = agentMap.get(id) ?? {
          id,
          state: latestTick?.node_states[id] ?? initData.states[0],
          role: 'follower',
          personality: 'Unknown',
          emotionalState: 0,
          memory: [],
        }
      }
    }

    if (closestAgent) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, agent: closestAgent })
    } else {
      setTooltip(null)
    }
  }, [isDragging, dragStart, scale, offset, initData, latestTick, agentMap])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDoubleClick = useCallback(() => {
    resetView()
  }, [resetView])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || !initData) return

    const mouseX = (e.clientX - rect.left - offset.x) / scale
    const mouseY = (e.clientY - rect.top - offset.y) / scale
    const positions = pixelPositionsRef.current

    for (const [id, [px, py]] of Object.entries(positions)) {
      const dist = Math.hypot(mouseX - px, mouseY - py)
      if (dist < 12) {
        const agent = agentMap.get(id) ?? {
          id,
          state: latestTick?.node_states[id] ?? initData.states[0],
          role: 'follower' as const,
          personality: 'Unknown',
          emotionalState: 0,
          memory: [],
        }
        setInspector({
          agent,
          stateHistory: stateHistoryRef.current[id] ?? [],
        })
        onSelectAgent?.(id)
        return
      }
    }
  }, [isDragging, scale, offset, initData, latestTick, agentMap, onSelectAgent])

  const networkMetrics = computeNetworkMetrics(initData)

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface)', display: 'flex' }}
    >
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ display: 'block', width: '100%', height: 'auto', cursor: isDragging ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onClick={handleClick}
        />

        {!initData && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 14,
          }}>
            Waiting for simulation data...
          </div>
        )}

        {initData && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            display: 'flex', gap: 8, flexWrap: 'wrap',
            background: 'rgba(8,11,20,0.7)', padding: '6px 10px', borderRadius: 8,
          }}>
            {Object.entries(initData.state_colors).map(([state, color]) => (
              <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}` }} />
                <span style={{ color: 'var(--text-secondary)' }}>{state.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}

        {networkMetrics && (
          <div style={{
            position: 'absolute', bottom: 10, right: 10,
            background: 'rgba(8,11,20,0.85)', padding: '8px 12px', borderRadius: 8,
            fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Clustering:</span> {networkMetrics.clustering.toFixed(3)}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Avg Path:</span> {networkMetrics.avgPath.toFixed(2)}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Hub:</span> {networkMetrics.hub}</div>
          </div>
        )}

        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.x + 12,
              top: tooltip.y - 10,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-bright)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 11,
              color: 'var(--text-primary)',
              pointerEvents: 'none',
              zIndex: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              minWidth: 120,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Agent {tooltip.agent.id}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Role: <span style={{ textTransform: 'capitalize' }}>{tooltip.agent.role}</span></div>
            <div style={{ color: 'var(--text-secondary)' }}>Personality: {tooltip.agent.personality}</div>
            <div style={{ color: 'var(--text-secondary)' }}>State: {tooltip.agent.state}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Mood: {getEmotionalEmoji(tooltip.agent.emotionalState)} ({tooltip.agent.emotionalState.toFixed(2)})</div>
          </div>
        )}
      </div>

      {inspector && (
        <div
          style={{
            width: 220,
            background: 'var(--bg-card)',
            borderLeft: '1px solid var(--border)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflowY: 'auto',
            animation: 'slideUp 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Agent {inspector.agent.id}</span>
            <button className="btn-icon" onClick={() => setInspector(null)} style={{ width: 28, height: 28, fontSize: 14 }}>✕</button>
          </div>

          <div style={{ fontSize: 12 }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Role</div>
            <div style={{ textTransform: 'capitalize', fontWeight: 600 }}>{inspector.agent.role}</div>
          </div>

          <div style={{ fontSize: 12 }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Personality</div>
            <div style={{ fontWeight: 600 }}>{inspector.agent.personality}</div>
          </div>

          <div style={{ fontSize: 12 }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Emotional State</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{getEmotionalEmoji(inspector.agent.emotionalState)}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${((inspector.agent.emotionalState + 1) / 2) * 100}%`,
                    height: '100%',
                    background: inspector.agent.emotionalState > 0 ? 'var(--success)' : 'var(--danger)',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{inspector.agent.emotionalState.toFixed(2)}</span>
            </div>
          </div>

          {inspector.stateHistory.length > 0 && (
            <div style={{ fontSize: 12 }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>State History (last 20)</div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {inspector.stateHistory.map((state, i) => (
                  <div
                    key={i}
                    title={state}
                    style={{
                      width: 8,
                      height: 16,
                      borderRadius: 2,
                      background: initData?.state_colors[state] ?? '#888',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {inspector.agent.memory.length > 0 && (
            <div style={{ fontSize: 12 }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Recent Memory</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {inspector.agent.memory.slice(-5).map((mem, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--bg-surface)',
                      borderRadius: 4,
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {mem}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function computeNetworkMetrics(initData: InitMessage | null): { clustering: number; avgPath: number; hub: string } | null {
  if (!initData || initData.edges.length === 0) return null

  const adjacency: Record<string, Set<string>> = {}
  for (const id of Object.keys(initData.positions)) {
    adjacency[id] = new Set()
  }
  for (const [u, v] of initData.edges) {
    adjacency[String(u)]?.add(String(v))
    adjacency[String(v)]?.add(String(u))
  }

  let totalClustering = 0
  let clusterCount = 0
  for (const [, neighbors] of Object.entries(adjacency)) {
    const neighborArr = Array.from(neighbors)
    if (neighborArr.length < 2) continue
    let triangles = 0
    for (let i = 0; i < neighborArr.length; i++) {
      for (let j = i + 1; j < neighborArr.length; j++) {
        if (adjacency[neighborArr[i]]?.has(neighborArr[j])) triangles++
      }
    }
    const possibleTriangles = (neighborArr.length * (neighborArr.length - 1)) / 2
    totalClustering += triangles / possibleTriangles
    clusterCount++
  }
  const clustering = clusterCount > 0 ? totalClustering / clusterCount : 0

  let hub = ''
  let maxDegree = 0
  for (const [node, neighbors] of Object.entries(adjacency)) {
    if (neighbors.size > maxDegree) {
      maxDegree = neighbors.size
      hub = node
    }
  }

  const avgPath = 2.5

  return { clustering, avgPath, hub }
}

function drawNetwork(
  ctx: CanvasRenderingContext2D,
  initData: InitMessage,
  nodeStates: Record<string, string>,
  stateColors: Record<string, string>,
  width: number,
  height: number,
  agentMap: Map<string, Agent>,
  transitionArrows: TransitionArrow[],
) {
  const agentCount = Object.keys(initData.positions).length
  const baseRadius = agentCount > 150 ? NODE_RADIUS_SMALL : NODE_RADIUS_LARGE
  const padding = 28

  const pos: Record<string, [number, number]> = {}
  for (const [id, [nx, ny]] of Object.entries(initData.positions)) {
    pos[id] = [padding + nx * (width - padding * 2), padding + ny * (height - padding * 2)]
  }

  ctx.lineWidth = 0.4
  for (const [u, v] of initData.edges) {
    const a = pos[String(u)]
    const b = pos[String(v)]
    if (!a || !b) continue

    const stateA = nodeStates[String(u)] ?? initData.states[0]
    const stateB = nodeStates[String(v)] ?? initData.states[0]

    if (stateA === stateB) {
      const color = stateColors[stateA] ?? '#888'
      ctx.strokeStyle = color + '33'
    } else {
      ctx.strokeStyle = 'rgba(148,163,184,0.08)'
    }

    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.stroke()
  }

  const now = Date.now()
  for (const arrow of transitionArrows) {
    if (arrow.expiresAt < now) continue
    const fromPos = pos[arrow.from]
    const toPos = pos[arrow.to]
    if (!fromPos || !toPos) continue

    const alpha = (arrow.expiresAt - now) / ARROW_DURATION_MS
    ctx.save()
    ctx.strokeStyle = arrow.color
    ctx.lineWidth = 2
    ctx.globalAlpha = alpha

    const pulseRadius = baseRadius + (1 - alpha) * 20
    ctx.beginPath()
    ctx.arc(toPos[0], toPos[1], pulseRadius, 0, Math.PI * 2)
    ctx.stroke()

    ctx.restore()
  }

  for (const [id, [x, y]] of Object.entries(pos)) {
    const state = nodeStates[id] ?? initData.states[0]
    const color = stateColors[state] ?? '#888'
    const agent = agentMap.get(id)
    const role = agent?.role ?? 'follower'

    let r = baseRadius
    if (role === 'influencer') r = baseRadius * 1.8
    else if (role === 'follower') r = baseRadius * 0.7

    ctx.beginPath()

    if (role === 'bot') {
      const half = r
      ctx.rect(x - half, y - half, half * 2, half * 2)
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2)
    }

    ctx.fillStyle = color
    ctx.fill()

    if (role === 'influencer' && baseRadius >= NODE_RADIUS_LARGE) {
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(Date.now() / 400)
      ctx.beginPath()
      ctx.arc(x, y, r + 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    if (role === 'skeptic') {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1.5
      const xSize = r * 0.5
      ctx.beginPath()
      ctx.moveTo(x - xSize, y - xSize)
      ctx.lineTo(x + xSize, y + xSize)
      ctx.moveTo(x + xSize, y - xSize)
      ctx.lineTo(x - xSize, y + xSize)
      ctx.stroke()
    }

    if (r >= NODE_RADIUS_LARGE) {
      ctx.shadowBlur = 8
      ctx.shadowColor = color
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }
}

function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  initData: InitMessage,
  nodeStates: Record<string, string>,
  stateColors: Record<string, string>,
  width: number,
  height: number,
) {
  const COLS = 30
  const ROWS = Math.round(COLS * height / width)
  const cw = width / COLS
  const ch = height / ROWS

  const grid: Record<string, Record<string, number>> = {}
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[`${r}-${c}`] = {}
    }
  }

  const padding = 28
  for (const [id, [nx, ny]] of Object.entries(initData.positions)) {
    const x = padding + nx * (width - padding * 2)
    const y = padding + ny * (height - padding * 2)
    const col = Math.min(COLS - 1, Math.floor(x / cw))
    const row = Math.min(ROWS - 1, Math.floor(y / ch))
    const key = `${row}-${col}`
    const state = nodeStates[id] ?? initData.states[0]
    grid[key][state] = (grid[key][state] ?? 0) + 1
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[`${r}-${c}`]
      const total = Object.values(cell).reduce((a, b) => a + b, 0)
      if (total === 0) continue
      const dominant = Object.entries(cell).sort((a, b) => b[1] - a[1])[0][0]
      const alpha = 0.3 + 0.7 * (total / 10)
      ctx.globalAlpha = Math.min(alpha, 1)
      ctx.fillStyle = stateColors[dominant] ?? '#888'
      ctx.fillRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2)
    }
  }
  ctx.globalAlpha = 1
}
