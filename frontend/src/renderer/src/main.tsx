import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { PREVIEW_BOOST_CALL_ID } from './features/levels/lib/boost'
import { useBoostStore } from './features/levels/store/boostStore'
import { useCallStore } from './features/call/store/callStore'
import { AppErrorBoundary } from './shared/ui/AppErrorScreen'
import { useLevelStore } from './features/levels/store/levelStore'
import { startThemeSync } from './features/settings/store/themeStore'
import { startEntranceSounds } from './features/call/lib/entranceSoundStart'
import { startScreenSounds } from './features/call/lib/screenSoundsStart'
import { startArrivalBadges } from './features/call/lib/arrivalEventsStart'
import { startCallInvites } from './features/call/lib/callInviteStart'
import { startPresenceActivity } from './features/activity/lib/presenceActivityStart'

// Tema salvo antes do primeiro render: o app já abre com as cores certas.
startThemeSync()

// Som de quem entra na call (o som de entrada da pessoa ou o padrão).
startEntranceSounds()

// Sons da transmissão: live aberta, encerrada e alguém entrando nela.
startScreenSounds()

// Selo "Chegou" de quem entra no canal de voz.
startArrivalBadges()

// Cartões de convite para a call na DM: viram "inválidos" quando a call acaba.
startCallInvites()

// O jogo e a música dos outros agora (presence:activity).
startPresenceActivity()

// Soltar um arquivo fora do chat não pode fazer o Electron abrir o arquivo no
// lugar do app (o chat trata o próprio drop).
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => e.preventDefault())

// Dev: `__salinhaLevelUp(85)` no console toca a animação de subir de nível;
// `__salinhaLevelUp('marco')` toca o pr�ximo marco depois do seu n�vel.
// `__salinhaBoost(175)` liga um buff de XP falso (125/150/175/200) na sua call.
if (import.meta.env.DEV) {
  const dev = window as unknown as {
    __salinhaLevelUp: (level: number | 'marco') => void
    __salinhaBoost: (percent: number) => void
  }
  dev.__salinhaLevelUp = (level) => {
    const store = useLevelStore.getState()
    if (level === 'marco') store.previewNextMilestone()
    else store.previewLevelUp(level)
  }
  dev.__salinhaBoost = (percent) =>
    useBoostStore.getState().previewBoost(useCallStore.getState().callId ?? PREVIEW_BOOST_CALL_ID, percent)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
)
