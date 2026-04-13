import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface UseExperimentLabOptions {
  assignExperimentGroups: (fraction: number) => Promise<boolean>
  injectTargeted: (group: 'control' | 'treatment', fraction: number, state?: string) => Promise<void>
}

export function useExperimentLab({ assignExperimentGroups, injectTargeted }: UseExperimentLabOptions) {
  const [treatmentFraction, setTreatmentFraction] = useState(0.5)
  const [groupsAssigned, setGroupsAssigned] = useState(false)
  const [targetedGroup, setTargetedGroup] = useState<'control' | 'treatment'>('treatment')
  const [targetedFraction, setTargetedFraction] = useState(0.2)

  const assignGroups = useCallback(async () => {
    const ok = await assignExperimentGroups(treatmentFraction)
    if (ok) {
      setGroupsAssigned(true)
      toast.success(`Groups assigned: ${Math.round(treatmentFraction * 100)}% treatment`)
    } else {
      toast.error('Failed to assign groups')
    }
  }, [assignExperimentGroups, treatmentFraction])

  const inject = useCallback(async () => {
    await injectTargeted(targetedGroup, targetedFraction)
    toast.success(`Injected seed into ${Math.round(targetedFraction * 100)}% of ${targetedGroup} group`)
  }, [injectTargeted, targetedGroup, targetedFraction])

  return {
    treatmentFraction, setTreatmentFraction,
    groupsAssigned,
    targetedGroup, setTargetedGroup,
    targetedFraction, setTargetedFraction,
    assignGroups,
    inject,
  }
}
