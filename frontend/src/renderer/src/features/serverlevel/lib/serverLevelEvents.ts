import { parseLevelUp, parseProgress, type ServerLevelProgress } from './serverLevel'

/** O que o tratamento dos eventos escreve (injetado: o teste não sobe o store). */
export interface ServerLevelEventDeps {
  apply: (progress: ServerLevelProgress) => void
  /** Subiu de nível: o aviso discreto (toast), sem mensagem no chat. */
  levelUp: (serverId: string, level: number) => void
}

/** server:level:update e server:level:up do WebSocket. */
export function handleServerLevelEvent(
  event: { type: string; payload: unknown },
  deps: ServerLevelEventDeps
): void {
  if (event.type === 'server:level:update') {
    const progress = parseProgress(event.payload)
    if (progress) deps.apply(progress)
    return
  }
  if (event.type === 'server:level:up') {
    const up = parseLevelUp(event.payload)
    if (up) deps.levelUp(up.serverId, up.level)
  }
}
