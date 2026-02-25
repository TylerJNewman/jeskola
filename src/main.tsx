import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/register-module-bodies'
import { App } from './components/App'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
