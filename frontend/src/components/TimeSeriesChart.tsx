import { useEffect, useRef } from 'react'
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend } from 'chart.js'
import type { TickMessage } from '../types/simulation'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

interface Props {
  history: TickMessage[]
  stateColors: Record<string, string>
  states: string[]
}

export default function TimeSeriesChart({ history, stateColors, states }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: [],
        datasets: states.map(state => ({
          label: state.replace(/_/g, ' '),
          data: [],
          borderColor: stateColors[state] ?? '#888',
          backgroundColor: (stateColors[state] ?? '#888') + '18',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#4a5580',
              maxTicksLimit: 10,
              font: { family: 'Inter', size: 11 },
            },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#4a5580',
              font: { family: 'Inter', size: 11 },
            },
            beginAtZero: true,
          },
        },
        plugins: {
          legend: {
            labels: {
              color: '#8b9cc8',
              font: { family: 'Inter', size: 12 },
              boxWidth: 12,
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: '#131c30',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#f0f4ff',
            bodyColor: '#8b9cc8',
            titleFont: { family: 'Inter', weight: 'bold' },
            bodyFont: { family: 'Inter' },
            padding: 12,
          },
        },
      },
    })
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [states, stateColors])

  // Stream data — keep up to 2000 ticks, downsample to 500 display points for performance
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || history.length === 0) return

    const MAX_HISTORY = 2000
    const MAX_DISPLAY = 500
    const capped = history.slice(-MAX_HISTORY)

    let display = capped
    if (capped.length > MAX_DISPLAY) {
      const step = Math.ceil(capped.length / MAX_DISPLAY)
      display = capped.filter((_, i) => i % step === 0)
    }

    chart.data.labels = display.map(h => `T${h.tick}`)
    states.forEach((state, i) => {
      chart.data.datasets[i].data = display.map(h => h.state_counts[state] ?? 0)
    })
    chart.update('none')
  }, [history, states])

  return (
    <div style={{ height: '100%', minHeight: 200, position: 'relative' }}>
      <canvas ref={canvasRef} />
      {history.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 14,
        }}>
          Waiting for data...
        </div>
      )}
    </div>
  )
}
