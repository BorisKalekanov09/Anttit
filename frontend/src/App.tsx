import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ConfigPage from './pages/ConfigPage'
import LivePage from './pages/LivePage'
import AnalysisPage from './pages/AnalysisPage'
import ComparisonPage from './pages/ComparisonPage'
import SettingsPage from './pages/SettingsPage'
import { AppShell } from './components/AppShell'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

export default function App() {
  return (
    <ErrorBoundary label="App">
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontFamily: 'Inter, sans-serif',
            },
          }}
        />
        <Routes>
          <Route
            path="/"
            element={
              <AppShell title="AgentSim">
                <ErrorBoundary label="Config">
                  <ConfigPage />
                </ErrorBoundary>
              </AppShell>
            }
          />
          <Route path="/live/:simId" element={
            <ErrorBoundary label="Live Simulation">
              <LivePage />
            </ErrorBoundary>
          } />
          <Route path="/analysis/:simId" element={
            <ErrorBoundary label="Analysis">
              <AnalysisPage />
            </ErrorBoundary>
          } />
          <Route path="/compare" element={
            <ErrorBoundary label="Comparison">
              <ComparisonPage />
            </ErrorBoundary>
          } />
          <Route path="/settings" element={
            <ErrorBoundary label="Settings">
              <SettingsPage />
            </ErrorBoundary>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
