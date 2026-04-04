import { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { InitMessage, TickMessage, Relationship } from '../types/simulation'

interface GraphNode {
  id: string
  state: string
  personality: string
  role: string
  color: string
  val: number
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number
  fy?: number
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
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
}

const RELATIONSHIP_COLORS: Record<string, string> = {
  INFLUENCES: '#4a90e2',
  SUPPORTS: '#22c55e',
  DISAGREES_WITH: '#ef4444',
  RELATES_TO: '#888',
}

export default function AgentGraphVisualization({
  initData,
  latestTick,
  relationships,
  width = 800,
  height = 600,
  onSelectAgent,
  onSelectRelationship,
}: AgentGraphVisualizationProps) {
  const graphRef = useRef<any>(null)
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: [],
  })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Rebuild nodes from latest tick, keep links from relationships
  useEffect(() => {
    if (!initData || !latestTick) return

    const nodes: GraphNode[] = Object.entries(latestTick.node_states).map(([id, state]) => ({
      id,
      state,
      personality: initData.agentProfiles?.find(p => p.id === id)?.personality ?? '',
      role: initData.agentProfiles?.find(p => p.id === id)?.role ?? 'default',
      color: initData.state_colors[state] ?? '#888',
      val: latestTick.agents?.find(a => a.id === id)?.role === 'influencer' ? 8 : 4,
    }))

    setGraphData(prev => ({ ...prev, nodes }))
  }, [initData, latestTick])

  // Update links from relationships
  useEffect(() => {
    if (!relationships.length) return

    const links: GraphLink[] = relationships.map(r => ({
      source: r.sourceAgentId,
      target: r.targetAgentId,
      type: r.type,
      strength: r.strength,
      narrative: r.narrative ?? '',
      id: r.id,
    }))

    setGraphData(prev => ({ ...prev, links }))
  }, [relationships])

  // If no relationships yet, show topology edges from initData
  useEffect(() => {
    if (relationships.length > 0 || !initData) return

    const links: GraphLink[] = initData.edges.slice(0, 600).map(([from, to]) => ({
      source: String(from),
      target: String(to),
      type: 'RELATES_TO',
      strength: 0.3,
      narrative: '',
      id: `${from}-${to}`,
    }))

    setGraphData(prev => ({ ...prev, links }))
  }, [initData, relationships.length])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedId(node.id)
    onSelectAgent?.(node.id)
  }, [onSelectAgent])

  const handleLinkClick = useCallback((link: GraphLink) => {
    const rel = relationships.find(r => r.id === link.id)
    if (rel) onSelectRelationship?.(rel)
  }, [relationships, onSelectRelationship])

  const drawArrow = useCallback((
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
    targetRadius: number
  ) => {
    const headlen = 5
    const angle = Math.atan2(toY - fromY, toX - fromX)

    // Calculate endpoint that stops at target node edge
    const endX = toX - Math.cos(angle) * targetRadius
    const endY = toY - Math.sin(angle) * targetRadius

    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 1.5

    // Arrow head
    ctx.beginPath()
    ctx.moveTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(endX, endY)
    ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6))
    ctx.stroke()
  }, [])

  const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    // Get source and target nodes
    const sourceNodeId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id
    const targetNodeId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id

    const sourceNode = graphData.nodes.find(n => n.id === sourceNodeId)
    const targetNode = graphData.nodes.find(n => n.id === targetNodeId)

    if (!sourceNode || !targetNode || sourceNode.x === undefined || sourceNode.y === undefined || targetNode.x === undefined || targetNode.y === undefined) {
      return
    }

    const color = RELATIONSHIP_COLORS[link.type] ?? '#555'
    const lineWidth = Math.max(0.5, (link.strength ?? 0.3) * 3)
    const sourceRadius = (sourceNode.val ?? 4)
    const targetRadius = (targetNode.val ?? 4)

    // Draw line from source node center to target node center
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.6

    // Calculate start point (edge of source node)
    const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x)
    const startX = sourceNode.x + Math.cos(angle) * sourceRadius
    const startY = sourceNode.y + Math.sin(angle) * sourceRadius

    // Calculate end point (edge of target node)
    const endX = targetNode.x - Math.cos(angle) * targetRadius
    const endY = targetNode.y - Math.sin(angle) * targetRadius

    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    ctx.globalAlpha = 1.0

    // Draw arrow if directional
    if (link.type !== 'RELATES_TO') {
      drawArrow(ctx, startX, startY, endX, endY, color, 0)
    }
  }, [graphData.nodes, drawArrow])

  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = node.id === selectedId
    const isHovered = node.id === hoveredId
    const radius = (node.val ?? 4) * (isSelected ? 1.5 : 1)

    // Glow for selected
    if (isSelected) {
      ctx.shadowColor = node.color
      ctx.shadowBlur = 12
    }

    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI)
    ctx.fillStyle = isSelected ? '#fff' : node.color
    ctx.fill()

    if (isSelected) {
      ctx.strokeStyle = node.color
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // Label on hover or select
    if ((isHovered || isSelected) && globalScale > 0.5) {
      const label = node.id
      const fontSize = Math.max(8, 11 / globalScale)
      ctx.font = `${fontSize}px Inter, Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + radius + 2)
    }
  }, [selectedId, hoveredId])

  if (!initData || !latestTick) {
    return (
      <div style={{
        width, height,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: 14,
      }}>
        Waiting for simulation data...
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', borderRadius: 8 }}>
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        // Node rendering
        nodeCanvasObject={paintNode as any}
        nodeCanvasObjectMode={() => 'replace'}
        // Link rendering (custom via canvas)
        linkCanvasObject={paintLink as any}
        linkCanvasObjectMode={() => 'replace'}
        linkLabel={(link: any) => link.narrative || link.type}
        // Physics
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={80}
        cooldownTicks={0}
        // Interactions
        onNodeClick={handleNodeClick as any}
        onNodeHover={(node: any) => setHoveredId(node?.id ?? null)}
        onLinkClick={handleLinkClick as any}
        // Background
        backgroundColor="transparent"
      />

      {/* Relationship type legend */}
      {relationships.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          display: 'flex', flexDirection: 'column', gap: 4,
          background: 'rgba(14,21,37,0.85)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 11,
          backdropFilter: 'blur(8px)',
        }}>
          {Object.entries(RELATIONSHIP_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 2, background: color, borderRadius: 1 }} />
              <span style={{ color: 'var(--text-secondary)' }}>{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Relationship count badge */}
      {relationships.length > 0 && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(14,21,37,0.85)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '4px 10px',
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}>
          {relationships.length} relationship{relationships.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
