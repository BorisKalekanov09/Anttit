import { useState, useCallback } from 'react'
import type { Relationship } from '../types/simulation'

export function usePanelState() {
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [systemConsoleOpen, setSystemConsoleOpen] = useState(false)
  const [infoPLazaOpen, setInfoPlazaOpen] = useState(false)
  const [groupsPanelOpen, setGroupsPanelOpen] = useState(false)
  const [relModalOpen, setRelModalOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [experimentLabOpen, setExperimentLabOpen] = useState(false)
  const [modalAgentId, setModalAgentId] = useState<string | null>(null)
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null)

  const openAgentModal = useCallback((agentId: string) => {
    setModalAgentId(agentId)
    setIsModalOpen(true)
  }, [])

  const closeAgentModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const openRelationshipModal = useCallback((rel: Relationship) => {
    setSelectedRelationship(rel)
    setRelModalOpen(true)
  }, [])

  const closeRelationshipModal = useCallback(() => {
    setRelModalOpen(false)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
    setSelectedRelationship(null)
  }, [])

  return {
    rightPanelOpen, setRightPanelOpen,
    sidebarOpen, setSidebarOpen,
    systemConsoleOpen, setSystemConsoleOpen,
    infoPLazaOpen, setInfoPlazaOpen,
    groupsPanelOpen, setGroupsPanelOpen,
    relModalOpen,
    isModalOpen,
    experimentLabOpen, setExperimentLabOpen,
    modalAgentId,
    selectedRelationship,
    openAgentModal,
    closeAgentModal,
    openRelationshipModal,
    closeRelationshipModal,
    closeSidebar,
  }
}
