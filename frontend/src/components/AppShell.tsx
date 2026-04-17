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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-void)' }}>
      {/* ── Fixed 56px Topbar ── */}
      <header style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 56,
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        zIndex: 50,
        gap: 0,
      }}>
        {/* Amber top-line accent */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 1,
          background: 'var(--gradient-accent)',
          opacity: 0.6,
        }} />

        {/* Left section: back + brand + page title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          {showBackButton && (
            <button
              onClick={() => navigate('/')}
              className="btn-icon"
              aria-label="Go back"
              style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, flexShrink: 0 }}
            >
              ←
            </button>
          )}

          {/* Brand wordmark */}
          <div
            onClick={() => navigate('/')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 0, flexShrink: 0 }}
          >
            <span style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
            }}>
              ANTT
            </span>
            <span style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
            }}>
              IT
            </span>
          </div>

          {/* Divider + page title (only when title is present) */}
          {title && <div style={{ width: 1, height: 16, background: 'var(--border-bright)', flexShrink: 0 }} />}

          {title && (
            <span style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {title}
            </span>
          )}
        </div>

        {/* Right section: action button */}
        {!isSettingsPage ? (
          <button
            onClick={() => navigate('/settings')}
            className="btn-secondary"
            style={{ padding: '6px 16px', fontSize: 10, letterSpacing: '0.1em', flexShrink: 0 }}
            title="Configure AI providers"
          >
            Config
          </button>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="btn-secondary"
            style={{ padding: '6px 16px', fontSize: 10, letterSpacing: '0.1em', flexShrink: 0 }}
            title="Back to simulator"
          >
            ← Back
          </button>
        )}
      </header>

      {/* ── Scrollable content area ── */}
      <main style={{ flex: 1, overflow: 'auto', paddingTop: 56 }}>
        <div style={{ minHeight: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
