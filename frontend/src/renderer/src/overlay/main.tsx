import './overlay.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import OverlayApp from './OverlayApp'
import { startThemeSync } from '../features/settings/store/themeStore'

// Mesmo tema do app (o localStorage é o mesmo; troca lá, troca aqui).
startThemeSync({ titleBar: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OverlayApp />
  </StrictMode>
)
