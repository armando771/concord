import { useServerStore } from '../../servers/store/serverStore'
import { useCallStore } from '../../call/store/callStore'
import { playSound } from '../../call/lib/sounds'
import { useServerLevelStore } from '../store/serverLevelStore'
import { useServerLevelUpStore } from '../store/serverLevelUpStore'
import { decideServerCelebration, readCelebrated, writeCelebrated } from './serverLevelCelebration'
import { serverLevelScene } from './serverLevelScene'

function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

const windowVisible = (): boolean =>
  typeof document !== 'undefined' && document.visibilityState === 'visible'

const currentServerId = (): string | null => useServerStore.getState().currentServer?.id ?? null

/** Você está neste servidor, com a janela à vista. */
export function isViewingServer(serverId: string): boolean {
  return currentServerId() === serverId && windowVisible()
}

/**
 * Oferece a subida do servidor para a animação (regra em
 * serverLevelCelebration): toca se você está nele e ainda não viu esse nível.
 * Devolve se tocou. O som respeita o ensurdecido, como os de nível.
 */
export function offerServerLevelUp(serverId: string, level: number, previous?: number): boolean {
  const decision = decideServerCelebration({
    level,
    previous,
    seen: readCelebrated(storage(), serverId),
    viewing: isViewingServer(serverId)
  })
  if (decision.remember !== undefined) writeCelebrated(storage(), serverId, decision.remember)
  if (!decision.play) return false
  useServerLevelUpStore.getState().show({ serverId, level, previous: decision.from })
  if (!useCallStore.getState().deafened) playSound(serverLevelScene(level).sound)
  return true
}

/**
 * Quem estava fora vê ao abrir o servidor: a cada servidor aberto (e quando
 * a janela volta a ficar à vista), assim que o nível dele está carregado,
 * oferece esse nível uma vez. Os updates seguintes da mesma visita não
 * contam (a subida ao vivo vem pelo server:level:up). Devolve o "desligar".
 */
export function watchServerLevelUps(): () => void {
  let visit = currentServerId()
  const tryVisit = (): void => {
    const progress = visit ? useServerLevelStore.getState().byServer[visit] : undefined
    if (!visit || !progress) return
    const id = visit
    visit = null
    offerServerLevelUp(id, progress.level)
  }
  const startVisit = (): void => {
    visit = currentServerId()
    tryVisit()
  }
  const offServers = useServerStore.subscribe((state, prev) => {
    if (state.currentServer?.id !== prev.currentServer?.id) startVisit()
  })
  const offLevels = useServerLevelStore.subscribe(tryVisit)
  const hasDocument = typeof document !== 'undefined'
  if (hasDocument) document.addEventListener('visibilitychange', startVisit)
  tryVisit()
  return () => {
    offServers()
    offLevels()
    if (hasDocument) document.removeEventListener('visibilitychange', startVisit)
  }
}
