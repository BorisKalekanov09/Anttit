import { useEffect, useRef, useMemo } from 'react'
import type { InitMessage, TickMessage } from '../types/simulation'

interface Props {
  initData: InitMessage | null
  latestTick: TickMessage | null
  width?: number
  height?: number
}

const NODE_RADIUS_SMALL = 5
const NODE_RADIUS_LARGE = 7
const HEATMAP_THRESHOLD = 300

export default function AgentNetwork({ initData, latestTick, width = 520, height = 420 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pixelPositionsRef = useRef<Record<string, [number, number]>>({})

  // Compute pixel positions once when initData arrives
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

  // Draw frame
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !initData) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, width, height)

    const stateColors = initData.state_colors
    const nodeStates = latestTick?.node_states ?? {}
    const agentCount = Object.keys(initData.positions).length
    const useHeatmap = agentCount > HEATMAP_THRESHOLD

    if (useHeatmap) {
      drawHeatmap(ctx, initData, nodeStates, stateColors, width, height)
    } else {
      drawNetwork(ctx, initData, nodeStates, stateColors, width, height)
    }
  }, [initData, latestTick, width, height])

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface)' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block', width: '100%', height: 'auto' }}
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
      {/* Legend */}
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
    </div>
  )
}

function drawNetwork(
  ctx: CanvasRenderingContext2D,
  initData: InitMessage,
  nodeStates: Record<string, string>,
  stateColors: Record<string, string>,
  width: number,
  height: number,
) {
  const agentCount = Object.keys(initData.positions).length
  const r = agentCount > 150 ? NODE_RADIUS_SMALL : NODE_RADIUS_LARGE
  const padding = 28

  // Pre-compute positions
  const pos: Record<string, [number, number]> = {}
  for (const [id, [nx, ny]] of Object.entries(initData.positions)) {
    pos[id] = [padding + nx * (width - padding * 2), padding + ny * (height - padding * 2)]
  }

  // Draw edges
  ctx.lineWidth = 0.4
  ctx.strokeStyle = 'rgba(148,163,184,0.08)'
  for (const [u, v] of initData.edges) {
    const a = pos[String(u)]
    const b = pos[String(v)]
    if (!a || !b) continue
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.stroke()
  }

  // Draw nodes
  for (const [id, [x, y]] of Object.entries(pos)) {
    const state = nodeStates[id] ?? initData.states[0]
    const color = stateColors[state] ?? '#888'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    // subtle glow on larger nodes
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

  // Initialize grid
  const grid: Record<string, Record<string, number>> = {}
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[`${r}-${c}`] = {}
    }
  }

  // Assign agents to cells
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

  // Draw cells
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
