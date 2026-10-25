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

/** Espalha os downloads em segundo plano por até 2 min (ver backgroundDownloadDelayMs). */
export const DOWNLOAD_JITTER_MAX_MS = 120_000

/**
 * Espera antes de baixar em segundo plano. O aviso do servidor (app:update)
 * e a checagem periódica acham a versão nova em todos os apps quase ao mesmo
 * tempo; baixar o instalador (~120 MB) junto saturaria o upload do servidor,
 * que é o mesmo da voz de quem está em chamada. O aviso na tela não espera.
 *
 * Sem espera: quando a pessoa pediu (Atualizar) e logo ao abrir o app (cada
 * um abre numa hora, e a instalação ao abrir precisa do download do cache
 * dentro da janela de início).
 */
export function backgroundDownloadDelayMs(
  state: {
    /** clicou em Atualizar */
    force: boolean
    msSinceStart: number
    /** Math.random(): [0, 1) */
    random: number
  },
  maxMs = DOWNLOAD_JITTER_MAX_MS
): number {
  if (state.force || state.msSinceStart <= STARTUP_WINDOW_MS) return 0
  const r = Math.min(Math.max(state.random, 0), 1)
  return Math.floor(r * maxMs)
}

/**
 * No Linux, o electron-updater só atualiza o próprio AppImage (variável
 * APPIMAGE, definida pelo runtime do AppImage). AppImage extraído (sem FUSE 2)
 * ou outra instalação roda sem ela e nunca acha versão nova: o app avisa.
 */
export function autoUpdateUnavailable(env: {
  platform: string
  isPackaged: boolean
  appImage: string | undefined
}): boolean {
  return env.platform === 'linux' && env.isPackaged && !env.appImage
}
