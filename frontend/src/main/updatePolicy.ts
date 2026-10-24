// Quando baixar/instalar atualizações. Puro para poder testar.

/** Atualização já baixada aparece em poucos segundos após abrir o app. */
const STARTUP_WINDOW_MS = 30_000

/** Não baixa em chamada: o upload do servidor é o mesmo que leva a mídia. */
export function canDownloadUpdate(inCall: boolean): boolean {
  return !inCall
}

/**
 * Instala sozinho só logo ao abrir e só se essa versão já tinha sido baixada e
 * verificada numa sessão anterior. Download que acabou agora — mesmo que
 * rápido — só gera o aviso "Nova atualização disponível".
 */
export function installOnStartup(state: {
  version: string
  /** versão verificada guardada da sessão anterior (userData) */
  verifiedBefore: string | null
  msSinceStart: number
  inCall: boolean
}): boolean {
  return (
    !state.inCall &&
    state.verifiedBefore === state.version &&
    state.msSinceStart <= STARTUP_WINDOW_MS
  )
}
