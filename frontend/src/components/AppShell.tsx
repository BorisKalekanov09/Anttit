import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface AppShellProps {
  children: React.ReactNode
  title?: string
  showBackButton?: boolean
}

export const AppShell: React.FC<AppShellProps> = ({ children, title, showBackButton = false }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const isSettingsPage = location.pathname === '/settings'

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-void)]">
      {/* Fixed 64px Topbar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[var(--bg-base)] border-b border-[var(--border)] flex items-center px-6 z-50">
        <div className="flex items-center gap-4 flex-1">
          {showBackButton && (
            <button
              onClick={() => navigate('/')}
              className="btn-icon"
              aria-label="Go back"
            >
              ←
            </button>
          )}
          {title && <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>}
        </div>

        {!isSettingsPage && (
          <button
            onClick={() => navigate('/settings')}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: 13 }}
            title="Configure AI providers"
          >
            ⚙️ Settings
          </button>
        )}
        {isSettingsPage && (
          <button
            onClick={() => navigate('/')}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: 13 }}
            title="Back to simulator"
          >
            ← Back
          </button>
        )}
      </header>

      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-auto pt-16">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  )
}
