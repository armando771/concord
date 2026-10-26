import { useNavigate } from 'react-router-dom'
import type { Channel } from '../api/channels'
import { useCallStore } from '../../call/store/callStore'
import { showToast } from '../../../shared/store/toastStore'
import { Perm } from '../lib/permissions'
import type { ServerAccess } from '../lib/serverAccess'
import { errorText } from '../lib/channelSidebar'

/**
 * Clique no canal de voz, estilo Discord: conecta ao canal e mostra a tela de
 * voz na área principal (sem permissão de entrar, avisa).
 */
export function useJoinVoiceChannel(
  access: ServerAccess,
  serverId: string | undefined
): (ch: Channel) => void {
  const navigate = useNavigate()
  const joinVoiceChannel = useCallStore((s) => s.joinVoiceChannel)
  return (ch) => {
    if (!access.canInChannel(ch.id, Perm.CONNECT)) {
      showToast.error('Você não tem permissão para entrar neste canal de voz.')
      return
    }
    joinVoiceChannel(ch.id)
      .then(() => {
        if (serverId) navigate(`/servers/${serverId}/channels/${ch.id}`)
      })
      .catch((err) => showToast.error(errorText(err, 'Falha ao conectar ao canal de voz.')))
  }
}
