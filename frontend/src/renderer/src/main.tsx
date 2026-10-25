import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useLevelStore } from './store/levelStore'

// Soltar um arquivo fora do chat não pode fazer o Electron abrir o arquivo no
// lugar do app (o chat trata o próprio drop).
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => e.preventDefault())

// Dev: `__salinhaLevelUp(85)` no console toca a animação de subir de nível;
// `__salinhaLevelUp('marco')` toca o próximo marco depois do seu nível.
if (import.meta.env.DEV) {
  ;(window as unknown as { __salinhaLevelUp: (level: number | 'marco') => void }).__salinhaLevelUp =
    (level) => {
      const store = useLevelStore.getState()
      if (level === 'marco') store.previewNextMilestone()
      else store.previewLevelUp(level)
    }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
