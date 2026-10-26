import { onWsEvent } from '../../../shared/api/ws'
import { API_BASE_URL } from '../../../shared/lib/config'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../store/callStore'
import { useSoundboardStore } from '../store/soundboardStore'
import { useUserAudioStore } from '../store/userAudioStore'
import { handleEntranceEvent, playJoinSound, type EntranceDeps } from './entranceSoundListener'
import { playEntranceClip } from './entranceSoundPlayer'
import { playSound } from './sounds'

const liveDeps: EntranceDeps = {
  call: () => useCallStore.getState(),
  meId: () => useAuthStore.getState().user?.id,
  isMuted: (userId) => useUserAudioStore.getState().get(userId).muted,
  volume: () => useSoundboardStore.getState().volume,
  apiBase: API_BASE_URL,
  playClip: playEntranceClip,
  playDefault: () => playSound('userJoin')
}

/**
 * Liga o som de "alguém entrou" (personalizado ou padrão) nos eventos do WS.
 * Chamado uma vez na entrada do app; devolve o "desligar".
 */
export function startEntranceSounds(): () => void {
  return onWsEvent((event) => void handleEntranceEvent(event, liveDeps))
}

/** "Ouvir" nas configurações: o som de entrada salvo (ou o padrão), como os outros ouvem. */
export function previewJoinSound(url: string | null | undefined): void {
  void playJoinSound({ id: '', entrance_sound_url: url }, liveDeps, false)
}
