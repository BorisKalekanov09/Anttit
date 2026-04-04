import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { SimConfig, WorldConfig } from '../types/simulation'
import { AppShell } from '../components/AppShell'
import WorldBuilder from '../components/WorldBuilder'
import GeneratedConfigApproval from '../components/GeneratedConfigApproval'

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

  const handleWorldBuilderConfig = (worldConfig: WorldConfig) => {
    const built: SimConfig = {
      theme: worldConfig.suggested_config.theme,
      agent_count: worldConfig.suggested_config.agent_count,
      topology: worldConfig.suggested_config.topology as SimConfig['topology'],
      tick_rate: worldConfig.suggested_config.tick_rate,
      personalities: worldConfig.personality_archetypes,
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
    <AppShell title="Configure Simulation">
      <div className="page-enter" style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <div className="glass slide-up" style={{ padding: '32px', minHeight: 400 }}>
          {step === 'builder' ? (
            <WorldBuilder
              onGenerateConfig={handleWorldBuilderConfig}
              onSkip={() => {
                toast.error('Please describe a scenario to continue')
              }}
            />
          ) : (
            <GeneratedConfigApproval
              config={config}
              onApprove={handleApprove}
              onEditTopic={() => setStep('builder')}
            />
          )}
        </div>
      </div>
    </AppShell>
  )
}
