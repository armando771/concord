import { onWsEvent } from '../../../shared/api/ws'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../store/callStore'
import { createScreenSoundGate, type ScreenSoundView } from './screenSounds'
import { playSound } from './sounds'

function viewOf(s: ReturnType<typeof useCallStore.getState>): ScreenSoundView {
  return {
    callId: s.callId,
    status: s.status,
    deafened: s.deafened,
    participantIds: s.participants.map((p) => p.id),
    sharers: s.screenSharers,
    watchers: s.screenWatchers
  }
}

/**
 * Liga os sons de transmissão (live aberta, encerrada, alguém entrou nela) nos
 * eventos do WS da call. Chamado uma vez na entrada do app; devolve o "desligar".
 */
export function startScreenSounds(): () => void {
  const gate = createScreenSoundGate({ play: playSound, now: Date.now })
  const offState = useCallStore.subscribe((next, prev) => {
    if (next.screenSharers === prev.screenSharers && next.screenWatchers === prev.screenWatchers) {
      return
    }
    gate.stateChanged(viewOf(prev), viewOf(next), useAuthStore.getState().user?.id)
    // O ouvinte do WS roda no mesmo turno; mudança fora disso não toca.
    queueMicrotask(gate.endOfTick)
  })
  const offEvents = onWsEvent(() => gate.wsEventHandled())
  return () => {
    offState()
    offEvents()
  }
}
