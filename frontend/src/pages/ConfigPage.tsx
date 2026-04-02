import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { ThemeDef, PersonalityDef, SimConfig } from '../types/simulation'
import { StepWizard } from '../components/StepWizard'
import ThemePicker from '../components/ThemePicker'
import { TopologyPreview } from '../components/TopologyPreview'
import PersonalityManager from '../components/PersonalityManager'
import { AppShell } from '../components/AppShell'

const STEPS = ['Theme', 'Network', 'Personalities', 'Seed']

const ROLE_ICONS: Record<string, string> = {
  influencer: '⭐',
  skeptic: '🔒',
  bot: '🤖',
  follower: '👤',
}

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

const DEFAULT_ROLE_MIX = {
  influencer: 10,
  skeptic: 15,
  bot: 5,
  follower: 70,
}

interface SeedResponse {
  suggestedConfig?: Partial<SimConfig>
  seedRationale: string
  suggestedPersonalities?: PersonalityDef[]
}

export default function ConfigPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [themes, setThemes] = useState<ThemeDef[]>([])
  const [loadingThemes, setLoadingThemes] = useState(true)
  const [config, setConfig] = useState<SimConfig>({
    theme: '',
    agent_count: 100,
    topology: 'small_world',
    tick_rate: 0.5,
    personalities: DEFAULT_PERSONALITIES,
  })
  const [roleMix, setRoleMix] = useState(DEFAULT_ROLE_MIX)
  const [launching, setLaunching] = useState(false)

  // Seed step state
  const [seedText, setSeedText] = useState('')
  const [generatingSeed, setGeneratingSeed] = useState(false)
  const [seedRationale, setSeedRationale] = useState('')
  const [showRationaleModal, setShowRationaleModal] = useState(false)

  // Fetch themes on mount
  useEffect(() => {
    setLoadingThemes(true)
    fetch('/api/themes')
      .then(r => r.json())
      .then(data => {
        setThemes(data)
        setLoadingThemes(false)
      })
      .catch(err => {
        console.error('Failed to load themes:', err)
        setLoadingThemes(false)
      })
  }, [])

  // Get selected theme data
  const selectedTheme = themes.find(t => t.key === config.theme)

  // Estimate performance
  const agentEstimate = () => {
    const n = config.agent_count
    const rate = config.tick_rate
    const msPerTick = Math.round(rate * 1000)
    if (n <= 100) return `~${msPerTick}ms/tick · lightweight`
    if (n <= 300) return `~${msPerTick + 200}ms/tick · moderate`
    return `~${msPerTick + 600}ms/tick · heavy`
  }

  // Normalize role mix to 100%
  const normalizeRoleMix = useCallback((mix: typeof roleMix, changedKey: string) => {
    const total = Object.values(mix).reduce((s, v) => s + v, 0)
    if (total === 100) return mix
    
    const diff = total - 100
    const others = Object.keys(mix).filter(k => k !== changedKey) as (keyof typeof mix)[]
    const otherTotal = others.reduce((s, k) => s + mix[k], 0)
    
    if (otherTotal === 0) return mix
    
    const newMix = { ...mix }
    for (const key of others) {
      const reduction = Math.round((mix[key] / otherTotal) * diff)
      newMix[key] = Math.max(0, mix[key] - reduction)
    }
    
    // Final adjustment to ensure exactly 100
    const newTotal = Object.values(newMix).reduce((s, v) => s + v, 0)
    if (newTotal !== 100) {
      const adjustKey = others.find(k => newMix[k] > 0) ?? changedKey
      newMix[adjustKey as keyof typeof mix] += 100 - newTotal
    }
    
    return newMix
  }, [])

  const handleRoleMixChange = (role: keyof typeof roleMix, value: number) => {
    const newMix = { ...roleMix, [role]: value }
    setRoleMix(normalizeRoleMix(newMix, role))
  }

  // Validation
  const validate = (): string | null => {
    if (!config.theme) return 'Please select a theme'
    if (config.personalities.length < 2) return 'Add at least 2 personality types'
    if (config.agent_count < 10) return 'Need at least 10 agents'
    const total = config.personalities.reduce((s, p) => s + p.suggested_percentage, 0)
    if (Math.abs(total - 100) > 2) return `Personality percentages must sum to 100 (currently ${total})`
    return null
  }

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return !!config.theme
      case 1: return config.agent_count >= 10
      case 2: return config.personalities.length >= 2
      case 3: return true
      default: return false
    }
  }

  // Generate seed scenario
  const handleGenerateSeed = async () => {
    if (!seedText.trim()) {
      toast.error('Please describe a scenario first')
      return
    }
    setGeneratingSeed(true)
    try {
      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: seedText, theme: config.theme }),
      })
      const data: SeedResponse = await res.json()
      
      if (data.seedRationale) {
        setSeedRationale(data.seedRationale)
        setShowRationaleModal(true)
      }
      
      if (data.suggestedPersonalities && data.suggestedPersonalities.length > 0) {
        setConfig(c => ({ ...c, personalities: data.suggestedPersonalities! }))
        toast.success('Personalities updated based on scenario!')
      }
      
      if (data.suggestedConfig) {
        setConfig(c => ({ ...c, ...data.suggestedConfig }))
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Seed generation failed'
      toast.error(errMsg)
    } finally {
      setGeneratingSeed(false)
    }
  }

  // Launch simulation
  const launch = async () => {
    const err = validate()
    if (err) { toast.error(err); return }
    setLaunching(true)
    try {
      const payload = {
        ...config,
        role_mix: roleMix,
        seed_text: seedText || undefined,
      }
      const res = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.sim_id) {
        toast.success('Simulation launched! 🚀')
        navigate(`/live/${data.sim_id}`)
      } else throw new Error(data.detail || 'Launch failed')
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Launch failed'
      toast.error(errMsg)
    } finally {
      setLaunching(false)
    }
  }

  // Navigation
  const goNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }
  const goBack = () => {
    if (step > 0) setStep(s => s - 1)
  }

  return (
    <AppShell title="Configure Simulation">
      <div className="page-enter" style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        {/* Step Wizard */}
        <div style={{ marginBottom: 40 }}>
          <StepWizard steps={STEPS} currentStep={step} />
        </div>

        {/* Step Content */}
        <div className="glass slide-up" style={{ padding: '32px', minHeight: 400 }}>
          {/* Step 0: Theme Selection */}
          {step === 0 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                Select a theme
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15, lineHeight: 1.6 }}>
                Choose the social phenomenon you want to simulate
              </p>
              
              <ThemePicker
                themes={themes}
                selected={config.theme}
                onSelect={theme => setConfig(c => ({ ...c, theme }))}
                loading={loadingThemes}
              />

              {selectedTheme && (
                <div 
                  className="fade-in"
                  style={{ 
                    marginTop: 24, 
                    padding: '16px 20px', 
                    background: 'var(--bg-surface)', 
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selectedTheme.name}:</span>{' '}
                    {selectedTheme.description}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedTheme.states.map((state) => (
                      <span
                        key={state}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 500,
                          background: selectedTheme.state_colors[state] + '20',
                          color: selectedTheme.state_colors[state],
                          border: `1px solid ${selectedTheme.state_colors[state]}40`,
                        }}
                      >
                        {state.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Network Configuration */}
          {step === 1 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                Configure network
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: 15, lineHeight: 1.6 }}>
                Set population size, simulation speed, and social topology
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
                {/* Left column: Sliders */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                  {/* Agent Count */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <label className="label" style={{ marginBottom: 0 }}>Agent Count</label>
                      <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                        {config.agent_count}
                      </span>
                    </div>
                    <input
                      type="range" min={10} max={1000}
                      value={config.agent_count}
                      onChange={e => setConfig(c => ({ ...c, agent_count: Number(e.target.value) }))}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      <span>10</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{agentEstimate()}</span>
                      <span>1000</span>
                    </div>
                  </div>

                  {/* Tick Rate */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <label className="label" style={{ marginBottom: 0 }}>Tick Rate</label>
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent2)' }}>
                        {config.tick_rate.toFixed(1)}s / tick
                      </span>
                    </div>
                    <input
                      type="range" min={0.1} max={2} step={0.1}
                      value={config.tick_rate}
                      onChange={e => setConfig(c => ({ ...c, tick_rate: Number(e.target.value) }))}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      <span>Fast (0.1s)</span>
                      <span>Slow (2s)</span>
                    </div>
                  </div>

                  {/* Role Mix Section */}
                  <div>
                    <label className="label" style={{ marginBottom: 12 }}>Role Distribution</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(Object.keys(roleMix) as (keyof typeof roleMix)[]).map(role => (
                        <div key={role}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 16 }}>{ROLE_ICONS[role]}</span>
                              <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{role}</span>
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                              {roleMix[role]}%
                            </span>
                          </div>
                          <input
                            type="range" min={0} max={100}
                            value={roleMix[role]}
                            onChange={e => handleRoleMixChange(role, Number(e.target.value))}
                          />
                        </div>
                      ))}
                    </div>
                    {/* Visual breakdown */}
                    <div style={{ 
                      marginTop: 16, 
                      display: 'flex', 
                      height: 8, 
                      borderRadius: 4, 
                      overflow: 'hidden',
                      background: 'var(--bg-surface)',
                    }}>
                      <div style={{ width: `${roleMix.influencer}%`, background: '#f59e0b', transition: 'width 0.2s' }} />
                      <div style={{ width: `${roleMix.skeptic}%`, background: '#22c55e', transition: 'width 0.2s' }} />
                      <div style={{ width: `${roleMix.bot}%`, background: '#6366f1', transition: 'width 0.2s' }} />
                      <div style={{ width: `${roleMix.follower}%`, background: '#94a3b8', transition: 'width 0.2s' }} />
                    </div>
                  </div>
                </div>

                {/* Right column: Topology */}
                <div>
                  <label className="label" style={{ marginBottom: 12 }}>Network Topology</label>
                  <TopologyPreview
                    topology={config.topology as 'small_world' | 'scale_free' | 'random' | 'grid'}
                    onSelect={topology => setConfig(c => ({ ...c, topology }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Personalities */}
          {step === 2 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                Set personalities
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15, lineHeight: 1.6 }}>
                Define agent behavior types and their distribution
              </p>
              
              <PersonalityManager
                personalities={config.personalities}
                onChange={personalities => setConfig(c => ({ ...c, personalities }))}
                theme={config.theme}
              />
            </div>
          )}

          {/* Step 3: Seed Scenario */}
          {step === 3 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                Scenario seed <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 16 }}>(optional)</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15, lineHeight: 1.6 }}>
                Describe a real-world event to use as a starting point for the simulation
              </p>

              <div style={{ marginBottom: 24 }}>
                <label className="label">Describe your scenario</label>
                <textarea
                  className="input"
                  value={seedText}
                  onChange={e => setSeedText(e.target.value)}
                  placeholder="e.g., 'A viral tweet claims a celebrity has died, but it's actually a hoax. Traditional media hasn't picked up the story yet, but it's spreading fast on social platforms.'"
                  rows={4}
                  style={{ resize: 'vertical', lineHeight: 1.6 }}
                />
              </div>

              <button
                className="btn-secondary"
                onClick={handleGenerateSeed}
                disabled={generatingSeed || !seedText.trim()}
                style={{ marginBottom: 32 }}
              >
                {generatingSeed ? '⏳ Generating...' : '✨ Generate Seed'}
              </button>

              {seedRationale && (
                <div 
                  className="fade-in"
                  style={{ 
                    padding: '20px 24px', 
                    background: 'var(--bg-surface)', 
                    borderRadius: 12,
                    border: '1px solid var(--border-bright)',
                    marginBottom: 24,
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 10, 
                    marginBottom: 12,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'var(--gradient-accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16,
                    }}>✦</div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>AI Analysis</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {seedRationale}
                  </p>
                </div>
              )}

              {/* Summary before launch */}
              <div 
                style={{ 
                  padding: '20px 24px', 
                  background: 'rgba(124,109,250,0.08)', 
                  borderRadius: 12,
                  border: '1px solid var(--accent-glow)',
                }}
              >
                <h4 style={{ fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>
                  Launch Summary
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 24px', fontSize: 14 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Theme:</span>{' '}
                    <span style={{ fontWeight: 600 }}>{selectedTheme?.name || config.theme}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Agents:</span>{' '}
                    <span style={{ fontWeight: 600 }}>{config.agent_count}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Topology:</span>{' '}
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{config.topology.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Tick Rate:</span>{' '}
                    <span style={{ fontWeight: 600 }}>{config.tick_rate}s</span>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Personalities:</span>{' '}
                    <span style={{ fontWeight: 600 }}>{config.personalities.map(p => p.name).join(', ')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: 24,
          padding: '0 4px',
        }}>
          <button
            className="btn-secondary"
            onClick={goBack}
            disabled={step === 0}
            style={{ 
              padding: '14px 32px', 
              fontSize: 15,
              opacity: step === 0 ? 0.4 : 1,
            }}
          >
            ← Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              className="btn-primary"
              onClick={goNext}
              disabled={!canProceed()}
              style={{ padding: '14px 32px', fontSize: 15 }}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn-primary glow-pulse"
              onClick={launch}
              disabled={launching || !config.theme}
              style={{ padding: '14px 40px', fontSize: 15 }}
            >
              {launching ? '⏳ Launching...' : '🚀 Launch Simulation'}
            </button>
          )}
        </div>

        {/* Rationale Modal */}
        {showRationaleModal && (
          <div 
            className="modal-overlay" 
            onClick={e => { if (e.target === e.currentTarget) setShowRationaleModal(false) }}
          >
            <div className="modal">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--gradient-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>✦</div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>Scenario Analysis</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI-generated configuration rationale</p>
                </div>
              </div>
              <div style={{ 
                color: 'var(--text-secondary)', 
                fontSize: 15, 
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
                maxHeight: 400,
                overflowY: 'auto',
              }}>
                {seedRationale}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <button 
                  className="btn-primary" 
                  onClick={() => setShowRationaleModal(false)}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
