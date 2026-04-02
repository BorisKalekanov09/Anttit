import { useEffect, useRef, useState, useCallback } from 'react'
import type { SimMessage, SimState, InitMessage, TickMessage } from '../types/simulation'

const WS_BASE = import.meta.env.VITE_WS_BASE ?? `ws://${window.location.hostname}:3001`

export function useSimulation(simId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<SimState>({
    simId: simId ?? '',
    tick: 0,
    running: false,
    paused: false,
    initData: null,
    latestTick: null,
    events: [],
    history: [],
    analysisReport: null,
  })

  useEffect(() => {
    if (!simId) return
    const ws = new WebSocket(`${WS_BASE}/ws/${simId}`)
    wsRef.current = ws

    ws.onopen = () => {
      setState(s => ({ ...s, running: true }))
    }

    ws.onmessage = (e) => {
      const msg: SimMessage = JSON.parse(e.data)
      if (msg.type === 'init') {
        setState(s => ({ ...s, initData: msg as InitMessage }))
      } else if (msg.type === 'tick') {
        const tick = msg as TickMessage
        setState(s => ({
          ...s,
          tick: tick.tick,
          latestTick: tick,
          events: [...tick.events, ...s.events].slice(0, 200),
          history: [...s.history, tick].slice(-2000),
        }))
      } else if (msg.type === 'analysis') {
        const analysisMsg = msg as any
        setState(s => ({ 
          ...s, 
          running: false, 
          analysisReport: analysisMsg.report || null,
        }))
      }
    }

    ws.onclose = () => {
      setState(s => ({ ...s, running: false }))
    }

    return () => {
      ws.close()
    }
  }, [simId])

  const control = useCallback(async (action: string, tick_rate?: number) => {
    await fetch(`/api/simulations/${simId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, tick_rate }),
    })
    if (action === 'pause') setState(s => ({ ...s, paused: true }))
    if (action === 'resume') setState(s => ({ ...s, paused: false }))
  }, [simId])

  const inject = useCallback(async (event_type: string, payload: object = {}) => {
    await fetch(`/api/simulations/${simId}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, payload }),
    })
  }, [simId])

  const snapshot = useCallback(async () => {
    const res = await fetch(`/api/simulations/${simId}/snapshot`)
    return await res.json()
  }, [simId])

  return { state, control, inject, snapshot }
}
