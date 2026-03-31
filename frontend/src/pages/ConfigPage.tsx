import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { ThemeDef, PersonalityDef, SimConfig } from '../types/simulation'
import ThemePicker from '../components/ThemePicker'
import PersonalityManager from '../components/PersonalityManager'

const TOPOLOGIES = [
  { key: 'small_world', label: 'Small World', desc: 'Realistic social networks — clustered with shortcuts', icon: '🌐' },
  { key: 'scale_free', label: 'Scale-Free', desc: 'Few highly-connected hubs (influencers)', icon: '⭐' },
  { key: 'random', label: 'Random', desc: 'Erdős–Rényi random connections', icon: '🎲' },
  { key: 'grid', label: 'Grid', desc: 'Spatial grid — neighbors only nearby', icon: '⊞' },
]

const DEFAULT_PERSONALITIES: PersonalityDef[] = [
  {
    name: 'Believer',
    description: 'Easily accepts and spreads information, highly social.',
    credulity: 80, influence: 70, stubbornness: 20, activity: 75,
    suggested_percentage: 50, color: '#6366f1',
  },
  {
    name: 'Skeptic',
    description: 'Questions claims, resistant to change, lower social activity.',
    credulity: 20, influence: 40, stubbornness: 80, activity: 40,
    suggested_percentage: 30, color: '#22c55e',
  },
  {
    name: 'Passive',
    description: 'Rarely initiates interactions, follows the majority.',
    credulity: 50, influence: 20, stubbornness: 50, activity: 20,
    suggested_percentage: 20, color: '#f59e0b',
  },
]

export default function ConfigPage() {
  const navigate = useNavigate()
  const [themes, setThemes] = useState<ThemeDef[]>([])
  const [config, setConfig] = useState<SimConfig>({
    theme: 'misinformation',
    agent_count: 3,
    topology: 'small_world',
    tick_rate: 0.4,
    personalities: DEFAULT_PERSONALITIES,
  })
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    fetch('/api/themes').then(r => r.json()).then(setThemes).catch(console.error)
  }, [])

  const agentEstimate = () => {
    const n = config.agent_count
    const rate = config.tick_rate
    const msPerTick = Math.round(rate * 1000)
    if (n <= 100) return `~${msPerTick}ms/tick · lightweight`
    if (n <= 300) return `~${msPerTick + 200}ms/tick · moderate`
    return `~${msPerTick + 600}ms/tick · heavy`
  }

  const validate = (): string | null => {
    if (!config.theme) return 'Please select a theme'
    if (config.personalities.length < 2) return 'Add at least 2 personality types'
    if (config.agent_count < 3) return 'Need at least 3 agents'
    const total = config.personalities.reduce((s, p) => s + p.suggested_percentage, 0)
    if (Math.abs(total - 100) > 2) return `Personality percentages must sum to 100 (currently ${total})`
    return null
  }

  const launch = async () => {
    const err = validate()
    if (err) { toast.error(err); return }
    setLaunching(true)
    try {
      const res = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.sim_id) {
        toast.success('Simulation launched! 🚀')
        navigate(`/live/${data.sim_id}`)
      } else throw new Error(data.detail || 'Launch failed')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: 'rgba(14,21,37,0.8)',
        backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em' }}>
            AgentSim
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Multi-Agent AI Simulation Platform
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="btn-primary glow-pulse"
          onClick={launch}
          disabled={launching}
          style={{ padding: '14px 36px', fontSize: 16 }}
        >
          {launching ? '⏳ Launching...' : '🚀 Launch Simulation'}
        </button>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 48 }}>

        {/* Hero */}
        <div className="fade-in" style={{ textAlign: 'center', paddingBottom: 16 }}>
          <h2 style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 16 }}>
            Design Your{' '}
            <span className="gradient-text">Society</span>
          </h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
            Configure agents, personalities, and social topology — then watch emergent behavior unfold in real time, powered by Gemini AI.
          </p>
        </div>

        {/* Section 1 — Theme */}
        <section className="slide-up">
          <ThemePicker
            themes={themes}
            selected={config.theme}
            onSelect={theme => setConfig(c => ({ ...c, theme }))}
          />
        </section>

        {/* Section 2 — Agent count + Topology */}
        <section className="glass slide-up" style={{ padding: '28px 32px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Population & Network Topology</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
            {/* Agent count */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="label" style={{ marginBottom: 0 }}>Agent Count</label>
                <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {config.agent_count}
                </span>
              </div>
              <input
                type="range" min={3} max={1000}
                value={config.agent_count}
                onChange={e => setConfig(c => ({ ...c, agent_count: Number(e.target.value) }))}
                style={{ marginBottom: 10 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>3</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{agentEstimate()}</span>
                <span>1000</span>
              </div>

              {/* Tick rate */}
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label className="label" style={{ marginBottom: 0 }}>Tick Speed</label>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent2)' }}>
                    {config.tick_rate.toFixed(1)}s / tick
                  </span>
                </div>
                <input
                  type="range" min={0.1} max={3} step={0.1}
                  value={config.tick_rate}
                  onChange={e => setConfig(c => ({ ...c, tick_rate: Number(e.target.value) }))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  <span>Fast (0.1s)</span>
                  <span>Slow (3s)</span>
                </div>
              </div>
            </div>

            {/* Topology picker */}
            <div>
              <label className="label">Social Graph Topology</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {TOPOLOGIES.map(t => (
                  <div
                    key={t.key}
                    onClick={() => setConfig(c => ({ ...c, topology: t.key }))}
                    className="topology-card"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      borderColor: config.topology === t.key ? 'var(--accent)' : 'transparent',
                      boxShadow: config.topology === t.key ? '0 0 16px var(--accent-glow)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{t.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — Personality Manager */}
        <section className="glass slide-up" style={{ padding: '28px 32px' }}>
          <PersonalityManager
            personalities={config.personalities}
            onChange={personalities => setConfig(c => ({ ...c, personalities }))}
            theme={config.theme}
          />
        </section>

        {/* Launch CTA */}
        <section style={{ display: 'flex', justifyContent: 'center', paddingBottom: 40 }}>
          <button
            className="btn-primary glow-pulse"
            onClick={launch}
            disabled={launching}
            style={{ padding: '18px 60px', fontSize: 18, borderRadius: 16 }}
          >
            {launching ? '⏳ Launching...' : '🚀 Launch Simulation'}
          </button>
        </section>

      </main>
    </div>
  )
}
