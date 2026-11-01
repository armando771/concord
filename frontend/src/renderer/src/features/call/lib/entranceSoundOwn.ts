import { API_BASE_URL } from '../../../shared/lib/config'
import { useAuthStore } from '../../auth/store/authStore'
import { useSoundboardStore } from '../store/soundboardStore'
import { playJoinSound } from './entranceSoundListener'
import { playEntranceClip } from './entranceSoundPlayer'
import { playSound } from './sounds'

/**
 * Eu entrei numa call de canal: toco o meu som de entrada (o salvo no perfil)
 * no lugar do som padrão de "eu entrei". Mesmas regras de quem ouve os outros:
 * ensurdecido ou sem som (ou se falhar), toca o padrão. Não passa pelo WS: o
 * `call:joined` da minha entrada é ignorado pelo ouvinte, e o perfil já tem a URL.
 */
export function playOwnJoinSound(deafened: boolean): Promise<void> {
  const me = useAuthStore.getState().user
  return playJoinSound(
    { id: me?.id ?? '', entrance_sound_url: me?.entrance_sound_url },
    {
      isMuted: () => false,
      volume: () => useSoundboardStore.getState().volume,
      apiBase: API_BASE_URL,
      playClip: playEntranceClip,
      playDefault: () => playSound('join')
    },
    deafened
  )
}
