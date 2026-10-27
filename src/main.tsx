import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminMetrics } from './components/AdminMetrics'
import { isAdminRoute } from './lib/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute() ? <AdminMetrics /> : <App />}
  </StrictMode>,
)
