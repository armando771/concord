// Transmitir o jogo em atividade direto na call, reaproveitando o
// compartilhamento de tela (startScreenShare): só muda quem escolhe a fonte.

export interface GameBroadcastDeps {
  game: string
  /** Estou compartilhando a tela agora (qualquer fonte). */
  sharing: boolean
  /** O compartilhamento atual é a janela deste jogo. */
  active: boolean
  /** Pede ao main a janela do jogo; devolve o id da fonte ou null. */
  prefer: (game: string) => Promise<string | null>
  /** Avisa o fluxo de som da janela qual fonte vai ser capturada. */
  notePicked: (sourceId: string) => void
  start: () => Promise<void>
  stop: () => void
  /** Depois de iniciar: o compartilhamento realmente começou? */
  isSharing: () => boolean
  remember: (game: string) => void
  notify: (message: string) => void
}

export const WINDOW_NOT_FOUND = (game: string): string =>
  `Não encontramos a janela de ${game}. Escolha qual janela compartilhar.`

/** Um clique: começa a transmitir a janela do jogo, ou encerra se já transmite. */
export async function toggleGameBroadcast(d: GameBroadcastDeps): Promise<void> {
  if (d.sharing) d.stop()
  if (d.sharing && d.active) return
  const sourceId = await d.prefer(d.game)
  if (sourceId) d.notePicked(sourceId)
  else d.notify(WINDOW_NOT_FOUND(d.game))
  // Sem a janela, o seletor normal abre para a pessoa escolher outra.
  await d.start()
  if (d.isSharing()) d.remember(d.game)
}

export interface BroadcastViewInput {
  game: string
  sharing: boolean
  canStream: boolean
  connected: boolean
  /** Jogo cuja janela o card está transmitindo (null = nenhum). */
  broadcasting: string | null
}

export interface BroadcastView {
  active: boolean
  disabled: boolean
  label: string
}

/** Estado visual do botão: ativo, desabilitado e rótulo (também o tooltip). */
export function broadcastView(i: BroadcastViewInput): BroadcastView {
  const active = i.sharing && i.broadcasting === i.game
  return {
    active,
    disabled: !i.connected || (!i.canStream && !i.sharing),
    label: active ? `Parar de transmitir ${i.game}` : `Transmitir ${i.game}`
  }
}

/** Classes do botão por estado (desabilitado, ativo, ocioso). */
export function broadcastTone(view: BroadcastView): string {
  if (view.disabled) return 'cursor-not-allowed bg-fg/5 text-gray-600'
  if (view.active) return 'cursor-pointer bg-success-strong text-white hover:bg-success-strong-hover'
  return 'cursor-pointer bg-fg/6 text-gray-200 hover:bg-fg/12 hover:text-strong'
}

/** O desktop sabe achar a janela do jogo (Electron no Windows). */
export function canBroadcastGame(win: { api?: { screenShare?: { preferGameWindow?: unknown } } } | undefined): boolean {
  return typeof win?.api?.screenShare?.preferGameWindow === 'function'
}
