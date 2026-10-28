import { onWsEvent } from '../../../shared/api/ws'
import { showToast } from '../../../shared/store/toastStore'
import { useServerStore } from '../../servers/store/serverStore'
import { useServerLevelStore } from '../store/serverLevelStore'
import { levelUpMessage } from './serverLevel'
import { handleServerLevelEvent, type ServerLevelEventDeps } from './serverLevelEvents'

const liveDeps: ServerLevelEventDeps = {
  apply: (progress) => useServerLevelStore.getState().apply(progress),
  levelUp: (serverId, level) => {
    const name = useServerStore.getState().servers.find((s) => s.id === serverId)?.name
    showToast.success(levelUpMessage(name, level), 6000)
    // A semana do detalhamento muda junto; recarrega se já estava na tela.
    if (useServerLevelStore.getState().week[serverId])
      void useServerLevelStore.getState().load(serverId)
  }
}

/**
 * Liga o nível do servidor ao WS (server:level:update/up): a barra anda e a
 * subida vira um toast. Chamado uma vez na entrada do app; devolve o "desligar".
 */
export function startServerLevels(): () => void {
  return onWsEvent((event) => handleServerLevelEvent(event, liveDeps))
}
