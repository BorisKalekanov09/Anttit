import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { SimConfig, WorldConfig } from '../types/simulation'
import { AppShell } from '../components/AppShell'
import WorldBuilder from '../components/WorldBuilder'
import GeneratedConfigApproval from '../components/GeneratedConfigApproval'
import { useProviderConfig } from '../hooks/useProviderConfig'

const DEFAULT_CONFIG: SimConfig = {
  theme: '',
  agent_count: 100,
  topology: 'small_world',
  tick_rate: 0.5,
  personalities: [],
}

export default function ConfigPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'builder' | 'approval'>('builder')
  const [config, setConfig] = useState<SimConfig>(DEFAULT_CONFIG)
  const { activeModels, fetchActiveModels } = useProviderConfig()

  useEffect(() => {
    fetchActiveModels()
  }, [fetchActiveModels])

  const handleWorldBuilderConfig = (worldConfig: WorldConfig) => {
    const built: SimConfig = {
      theme: worldConfig.suggested_config.theme,
      agent_count: worldConfig.suggested_config.agent_count,
      topology: worldConfig.suggested_config.topology as SimConfig['topology'],
      tick_rate: worldConfig.suggested_config.tick_rate,
      personalities: worldConfig.personality_archetypes,
      modelName: activeModels
        ? `${activeModels.agentDecision.provider}:${activeModels.agentDecision.modelId}`
        : undefined,
      ideologicalGroups: worldConfig.ideologicalGroups,
    }
    setConfig(built)
    setStep('approval')
  }

  const handleApprove = async (approvedConfig: SimConfig) => {
    try {
      const res = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvedConfig),
      })
      const data = await res.json()
      if (data.sim_id) {
        toast.success('Simulation launched!')
        navigate(`/live/${data.sim_id}`)
      } else throw new Error(data.detail || 'Launch failed')
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Launch failed'
      toast.error(errMsg)
    }
  }

  return (
    <AppShell>
      <div className="page-enter" style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '64px 24px 80px',
      }}>
        <div style={{ width: '100%', maxWidth: 680 }}>

          {step === 'builder' ? (
            <>
              {/* ── Hero ── */}
              <div style={{ marginBottom: 48, textAlign: 'center' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 20,
                  padding: '5px 14px',
                  borderRadius: 2,
                  background: 'rgba(232, 160, 32, 0.08)',
                  border: '1px solid rgba(232, 160, 32, 0.2)',
                }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--accent)',
                    boxShadow: '0 0 8px var(--accent-glow)',
                  }} />
                  <span style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                  }}>
                    Multi-Agent Simulation
                  </span>
                </div>

                <h1 style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 52,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.0,
                  color: 'var(--text-primary)',
                  marginBottom: 20,
                }}>
                  Design worlds.<br />
                  <span style={{
                    background: 'var(--gradient-accent)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    Run simulations.
                  </span>
                </h1>

                <p style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 15,
                  color: 'var(--text-muted)',
                  lineHeight: 1.7,
                  maxWidth: 440,
                  margin: '0 auto',
                }}>
                  Describe any scenario in plain language. AI generates agents, personalities, topology, and belief systems — ready to launch.
                </p>
              </div>

              {/* ── Provider tip ── */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                borderRadius: 3,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                marginBottom: 32,
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>💡</span>
                <p style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                  letterSpacing: '0.02em',
                }}>
                  Using a different AI provider?{' '}
                  <span
                    onClick={() => navigate('/settings')}
                    style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    Open Config
                  </span>
                  {' '}to set API keys and choose models.
                </p>
              </div>

              {/* ── World builder form ── */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '32px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Top amber line */}
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: 2,
                  background: 'var(--gradient-accent)',
                }} />
                <WorldBuilder
                  onGenerateConfig={handleWorldBuilderConfig}
                  onSkip={() => toast.error('Please describe a scenario to continue')}
                />
              </div>
            </>
          ) : (
            <div className="slide-up" style={{ width: '100%', maxWidth: 820, margin: '0 auto' }}>
              <GeneratedConfigApproval
                config={config}
                onApprove={handleApprove}
                onEditTopic={() => setStep('builder')}
              />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
