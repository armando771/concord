import { onWsEvent } from '../../../shared/api/ws'
import { showToast } from '../../../shared/store/toastStore'
import { useServerStore } from '../../servers/store/serverStore'
import { useServerLevelStore } from '../store/serverLevelStore'
import { levelUpMessage } from './serverLevel'
import { handleServerLevelEvent, type ServerLevelEventDeps } from './serverLevelEvents'
import { isViewingServer, offerServerLevelUp, watchServerLevelUps } from './serverLevelUpStart'
import { useServerLevelUpStore } from '../store/serverLevelUpStore'

const liveDeps: ServerLevelEventDeps = {
  apply: (progress) => useServerLevelStore.getState().apply(progress),
  levelUp: (serverId, level, previous) => {
    // Quem está no servidor ganha a animação; quem está fora, o toast (e a
    // animação depois, ao abrir o servidor).
    offerServerLevelUp(serverId, level, previous)
    const name = useServerStore.getState().servers.find((s) => s.id === serverId)?.name
    if (!isViewingServer(serverId)) showToast.success(levelUpMessage(name, level), 6000)
    // A semana do detalhamento muda junto; recarrega se já estava na tela.
    if (useServerLevelStore.getState().week[serverId])
      void useServerLevelStore.getState().load(serverId)
  }
}

/**
 * Liga o nível do servidor ao WS (server:level:update/up): a barra anda e a
 * subida vira a animação (ou um toast, para quem está fora do servidor).
 * Chamado uma vez na entrada do app; devolve o "desligar".
 */
/**
 * Só em dev: `__salinhaServerLevelUp(25)` no console toca a animação de
 * subida do servidor aberto (sem subir de verdade).
 */
export function previewServerLevelUp(level: number): void {
  const { currentServer, servers } = useServerStore.getState()
  const serverId = currentServer?.id ?? servers[0]?.id ?? 'dev'
  useServerLevelUpStore.getState().show({ serverId, level, previous: Math.max(1, level - 1) })
}

function exposeDevPreview(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  ;(window as unknown as { __salinhaServerLevelUp: unknown }).__salinhaServerLevelUp =
    previewServerLevelUp
}

export function startServerLevels(): () => void {
  exposeDevPreview()
  const offWs = onWsEvent((event) => handleServerLevelEvent(event, liveDeps))
  const offWatch = watchServerLevelUps()
  return () => {
    offWs()
    offWatch()
  }
}
