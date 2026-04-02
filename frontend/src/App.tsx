import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ConfigPage from './pages/ConfigPage'
import LivePage from './pages/LivePage'
import AnalysisPage from './pages/AnalysisPage'
import { AppShell } from './components/AppShell'
import './index.css'

export default function App() {
  return (
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
              <ConfigPage />
            </AppShell>
          }
        />
        <Route path="/live/:simId" element={<LivePage />} />
        <Route path="/analysis/:simId" element={<AnalysisPage />} />
      </Routes>
    </BrowserRouter>
  )
}
