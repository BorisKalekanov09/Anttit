import { useEffect, useRef, useCallback, useState } from 'react'
import * as d3 from 'd3'
import type { InitMessage, TickMessage, Relationship } from '../types/simulation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  state: string
  color: string
  val: number   // radius multiplier (influencer = 8, default = 4)
}

interface SimLink {
  source: SimNode
  target: SimNode
  type: string
  strength: number
  narrative: string
  id: string
}

interface AgentGraphVisualizationProps {
  initData: InitMessage | null
  latestTick: TickMessage | null
  relationships: Relationship[]
  width?: number
  height?: number
  onSelectAgent?: (agentId: string) => void
  onSelectRelationship?: (rel: Relationship) => void
  highlightState?: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REL_COLORS: Record<string, string> = {
  INFLUENCES: '#00a8b5',
  SUPPORTS:   '#22c55e',
  DISAGREES_WITH: '#ef4444',
  RELATES_TO: '#888888',
}

const ARROW_LEN = 7
const HIT_RADIUS = 12   // px for node click detection
const LINK_HIT   = 6    // px for link click detection

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ptSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentGraphVisualization({
  initData,
  latestTick,
  relationships,
  width = 800,
  height = 600,
  onSelectAgent,
  onSelectRelationship,
  highlightState = null,
}: AgentGraphVisualizationProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const simRef     = useRef<d3.Simulation<SimNode, never> | null>(null)
  const nodesRef   = useRef<SimNode[]>([])
  const linksRef   = useRef<SimLink[]>([])
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const hoveredRef = useRef<SimNode | null>(null)
  const selectedRef = useRef<string | null>(null)
  const rafRef     = useRef<number>(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ── Draw ──────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.clearRect(0, 0, width, height)

    // If no data yet, draw waiting message directly on the canvas
    if (nodesRef.current.length === 0) {
      ctx.fillStyle = 'rgba(150,160,180,0.6)'
      ctx.font = '14px Inter, Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Waiting for simulation data...', width / 2, height / 2)
      ctx.restore()
      return
    }

    const t = transformRef.current
    ctx.translate(t.x, t.y)
    ctx.scale(t.k, t.k)

    const nodes = nodesRef.current
    const links = linksRef.current

    // ── Links ──────────────────────────────────────────────────────────────
    for (const link of links) {
      const s = link.source
      const tgt = link.target
      if (s.x == null || s.y == null || tgt.x == null || tgt.y == null) continue

      const color = REL_COLORS[link.type] ?? '#555'
      const lw    = Math.max(0.5, link.strength * 2.5)
      const angle = Math.atan2(tgt.y - s.y, tgt.x - s.x)
      const sr    = s.val ?? 4
      const tr    = tgt.val ?? 4

      const x1 = s.x + Math.cos(angle) * sr
      const y1 = s.y + Math.sin(angle) * sr
      const x2 = tgt.x - Math.cos(angle) * tr
      const y2 = tgt.y - Math.sin(angle) * tr

      ctx.save()
      ctx.globalAlpha = 0.65
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.lineCap = 'round'

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      // Arrow head (directional relationships)
      if (link.type !== 'RELATES_TO') {
        const ax = x2 - ARROW_LEN * Math.cos(angle - Math.PI / 6)
        const ay = y2 - ARROW_LEN * Math.sin(angle - Math.PI / 6)
        const bx = x2 - ARROW_LEN * Math.cos(angle + Math.PI / 6)
        const by = y2 - ARROW_LEN * Math.sin(angle + Math.PI / 6)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    // ── Nodes ──────────────────────────────────────────────────────────────
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue
      const isSelected = node.id === selectedRef.current
      const isHovered  = node === hoveredRef.current
      const r = (node.val ?? 4) * (isSelected ? 1.5 : 1)
      const isDimmed = highlightState !== null && node.state !== highlightState && !isSelected

      ctx.save()
      if (isDimmed) ctx.globalAlpha = 0.12
      if (isSelected) {
        ctx.shadowColor = node.color
        ctx.shadowBlur  = 14
      }

      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? '#ffffff' : node.color
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = node.color
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      if (isHovered || isSelected) {
        const fontSize = Math.max(8, 11 / t.k)
        ctx.font = `${fontSize}px Inter, Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        ctx.fillText(node.id, node.x, node.y + r + 2)
      }

      ctx.restore()
    }

    ctx.restore()
  }, [width, height, highlightState])

  // ── Simulation setup (once) ────────────────────────────────────────────────

  const initSimulation = useCallback(() => {
    const sim = d3.forceSimulation<SimNode>()
      .force('charge', d3.forceManyBody<SimNode>().strength(-120).distanceMax(250))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius(n => (n.val ?? 4) + 4))
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04))
      .alphaDecay(0.03)
      .velocityDecay(0.4)
      .on('tick', draw)

    simRef.current = sim
    return sim
  }, [width, height, draw])

  // ── Update simulation nodes/links (structural change) ─────────────────────

  const applyStructure = useCallback((nodes: SimNode[], links: SimLink[]) => {
    nodesRef.current = nodes
    linksRef.current = links

    const sim = simRef.current ?? initSimulation()

    const linkForce = d3.forceLink<SimNode, SimLink>(links as any)
      .id(d => d.id)
      .strength(l => Math.max(0.1, l.strength * 0.4))
      .distance(60)

    sim
      .nodes(nodes)
      .force('link', linkForce)
      .alpha(0.6)
      .restart()
  }, [initSimulation])

  // ── Bootstrap simulation once ──────────────────────────────────────────────

  useEffect(() => {
    if (!simRef.current) initSimulation()
    return () => {
      simRef.current?.stop()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [initSimulation])

  // ── Sync nodes when tick data changes (mutate in place — no restart) ───────

  useEffect(() => {
    if (!initData || !latestTick?.node_states || !initData.state_colors) return

    const existing = new Map(nodesRef.current.map(n => [n.id, n]))
    let structureChanged = false

    for (const [id, state] of Object.entries(latestTick.node_states)) {
      const color = initData.state_colors[state] ?? '#888'
      const val   = latestTick.agents?.find(a => a.id === id)?.role === 'influencer' ? 8 : 4

      if (existing.has(id)) {
        // Mutate in place — simulation keeps its internal reference, no restart
        const n = existing.get(id)!
        n.state = state
        n.color = color
        n.val   = val
      } else {
        structureChanged = true
        existing.set(id, {
          id,
          state,
          color,
          val,
          personality: initData.agentProfiles?.find(p => p.id === id)?.personality ?? '',
          role: initData.agentProfiles?.find(p => p.id === id)?.role ?? 'default',
        } as SimNode)
      }
    }

    if (structureChanged) {
      applyStructure(Array.from(existing.values()), linksRef.current)
    } else {
      // Just redraw with updated colors — no simulation restart
      draw()
    }
  }, [initData, latestTick, applyStructure, draw])

  // ── Sync links from relationships ─────────────────────────────────────────

  useEffect(() => {
    if (!relationships.length) return

    const nodeMap = new Map(nodesRef.current.map(n => [n.id, n]))
    const links: SimLink[] = relationships.flatMap(r => {
      const s = nodeMap.get(r.sourceAgentId)
      const t = nodeMap.get(r.targetAgentId)
      if (!s || !t) return []
      return [{
        source: s,
        target: t,
        type: r.type,
        strength: r.strength,
        narrative: r.narrative ?? '',
        id: r.id,
      }]
    })

    applyStructure(nodesRef.current, links)
  }, [relationships, applyStructure])

  // ── Topology edges fallback ────────────────────────────────────────────────

  useEffect(() => {
    if (relationships.length > 0 || !initData?.edges) return

    const nodeMap = new Map(nodesRef.current.map(n => [n.id, n]))
    const links: SimLink[] = initData.edges.slice(0, 400).flatMap(([from, to]) => {
      const s = nodeMap.get(String(from))
      const t = nodeMap.get(String(to))
      if (!s || !t) return []
      return [{
        source: s,
        target: t,
        type: 'RELATES_TO',
        strength: 0.3,
        narrative: '',
        id: `${from}-${to}`,
      }]
    })

    applyStructure(nodesRef.current, links)
  }, [initData, relationships.length, applyStructure])

  // ── Zoom, Pan & Pointer events (all native — no React synthetic conflicts) ──

  // Keep latest callbacks in refs so the effect never needs to re-run
  const onSelectAgentRef      = useRef(onSelectAgent)
  const onSelectRelationshipRef = useRef(onSelectRelationship)
  useEffect(() => { onSelectAgentRef.current = onSelectAgent }, [onSelectAgent])
  useEffect(() => { onSelectRelationshipRef.current = onSelectRelationship }, [onSelectRelationship])
  const relationshipsRef = useRef(relationships)
  useEffect(() => { relationshipsRef.current = relationships }, [relationships])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ── D3 zoom ──────────────────────────────────────────────────────────────
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', e => {
        transformRef.current = e.transform
        // Update cursor during pan
        canvas.style.cursor = e.sourceEvent?.type === 'mousemove' ? 'grabbing' : 'grab'
        draw()
      })

    const sel = d3.select(canvas)
    sel.call(zoom)

    // ── Helper: canvas → world coordinates ───────────────────────────────────
    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const t    = transformRef.current
      return {
        wx: (clientX - rect.left - t.x) / t.k,
        wy: (clientY - rect.top  - t.y) / t.k,
      }
    }

    // ── Mousemove — hover detection ───────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      const { wx, wy } = toWorld(e.clientX, e.clientY)
      const prev = hoveredRef.current
      let closest: SimNode | null = null
      let bestDist = HIT_RADIUS / transformRef.current.k

      for (const n of nodesRef.current) {
        if (n.x == null || n.y == null) continue
        const d = Math.hypot(wx - n.x, wy - n.y)
        if (d < bestDist) { bestDist = d; closest = n }
      }

      if (closest !== prev) {
        hoveredRef.current = closest
        canvas.style.cursor = closest ? 'pointer' : 'grab'
        draw()
      }
    }

    // ── Click — node / link hit test ─────────────────────────────────────────
    const onClick = (e: MouseEvent) => {
      // D3 zoom sets defaultPrevented=true after a pan drag — ignore those
      if (e.defaultPrevented) return

      const { wx, wy } = toWorld(e.clientX, e.clientY)
      const k = transformRef.current.k

      // Node hit test
      let bestNode: SimNode | null = null
      let bestDist = HIT_RADIUS / k
      for (const n of nodesRef.current) {
        if (n.x == null || n.y == null) continue
        const d = Math.hypot(wx - n.x, wy - n.y)
        if (d < bestDist) { bestDist = d; bestNode = n }
      }

      if (bestNode) {
        selectedRef.current = bestNode.id
        setSelectedId(bestNode.id)
        onSelectAgentRef.current?.(bestNode.id)
        draw()
        return
      }

      // Link hit test
      const linkHit = LINK_HIT / k
      for (const link of linksRef.current) {
        const s = link.source, t = link.target
        if (s.x == null || s.y == null || t.x == null || t.y == null) continue
        if (ptSegDist(wx, wy, s.x, s.y, t.x, t.y) < linkHit) {
          const rel = relationshipsRef.current.find(r => r.id === link.id)
          if (rel) {
            onSelectRelationshipRef.current?.(rel)
          } else {
            onSelectRelationshipRef.current?.({
              id: link.id, simId: '',
              sourceAgentId: s.id, targetAgentId: t.id,
              type: 'RELATES_TO', strength: link.strength,
              narrative: 'Direct network connection — no social influence recorded yet.',
            })
          }
          return
        }
      }

      // Empty space — deselect
      selectedRef.current = null
      setSelectedId(null)
      draw()
    }

    const onMouseLeave = () => {
      hoveredRef.current = null
      canvas.style.cursor = 'grab'
      draw()
    }

    canvas.addEventListener('mousemove',  onMouseMove)
    canvas.addEventListener('click',      onClick)
    canvas.addEventListener('mouseleave', onMouseLeave)

    return () => {
      sel.on('.zoom', null)
      canvas.removeEventListener('mousemove',  onMouseMove)
      canvas.removeEventListener('click',      onClick)
      canvas.removeEventListener('mouseleave', onMouseLeave)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw])   // draw is stable (depends only on width/height); callbacks go through refs

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', borderRadius: 8 }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block', cursor: 'grab' }}
      />

      {/* Legend */}
      {relationships.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          display: 'flex', flexDirection: 'column', gap: 4,
          background: 'rgba(14,21,37,0.85)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', fontSize: 11,
          backdropFilter: 'blur(8px)', pointerEvents: 'none',
        }}>
          {Object.entries(REL_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 2, background: color, borderRadius: 1 }} />
              <span style={{ color: 'var(--text-secondary)' }}>{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Count badge */}
      {relationships.length > 0 && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(14,21,37,0.85)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: '4px 10px', fontSize: 11,
          color: 'var(--text-secondary)', pointerEvents: 'none',
        }}>
          {relationships.length} relationship{relationships.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
