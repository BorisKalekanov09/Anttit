import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ConfigPage from './pages/ConfigPage'
import LivePage from './pages/LivePage'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#131c30',
            color: '#f0f4ff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontFamily: 'Inter, sans-serif',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<ConfigPage />} />
        <Route path="/live/:simId" element={<LivePage />} />
      </Routes>
    </BrowserRouter>
  )
}
