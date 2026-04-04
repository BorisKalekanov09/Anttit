import React from 'react'

interface StepWizardProps {
  steps: string[]
  currentStep: number
}

export const StepWizard: React.FC<StepWizardProps> = ({ steps, currentStep }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0 }}>
      {steps.map((label, idx) => (
        <React.Fragment key={idx}>
          {/* Step circle + label */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13,
              transition: 'all 0.25s',
              background: idx <= currentStep ? 'var(--accent)' : 'var(--bg-card)',
              color: idx <= currentStep ? '#fff' : 'var(--text-secondary)',
              border: idx === currentStep
                ? '2px solid var(--accent)'
                : idx < currentStep
                  ? '2px solid var(--accent)'
                  : '1px solid var(--border)',
              boxShadow: idx === currentStep ? '0 0 0 3px var(--accent-glow)' : 'none',
            }}>
              {idx < currentStep ? '✓' : idx + 1}
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: idx === currentStep ? 700 : 400,
              color: idx === currentStep ? 'var(--accent)' : idx < currentStep ? 'var(--text-secondary)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
            }}>
              {label}
            </span>
          </div>

          {/* Connector line between steps */}
          {idx < steps.length - 1 && (
            <div style={{
              height: 2, width: 48, flexShrink: 0,
              background: idx < currentStep ? 'var(--accent)' : 'var(--border)',
              borderRadius: 1,
              marginTop: 17, // align with circle center
              transition: 'background 0.25s',
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
