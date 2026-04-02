import React from 'react'

interface StepWizardProps {
  steps: string[]
  currentStep: number
}

export const StepWizard: React.FC<StepWizardProps> = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((_, idx) => (
        <React.Fragment key={idx}>
          <div
            className={`
              flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm
              transition-all duration-300
              ${
                idx < currentStep
                  ? 'bg-[var(--accent)] text-white'
                  : idx === currentStep
                    ? 'bg-[var(--accent)] text-white ring-2 ring-[var(--accent-glow)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)]'
              }
            `}
          >
            {idx < currentStep ? '✓' : idx + 1}
          </div>
          {idx < steps.length - 1 && (
            <div
              className={`
                h-1 w-16 rounded-full transition-all duration-300
                ${idx < currentStep ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}
              `}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
