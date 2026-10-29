/**
 * Foco automático no campo de mensagem ao abrir (ou trocar de) canal ou DM.
 * Só com mouse/trackpad: em tela de toque o foco abriria o teclado virtual.
 */

/**
 * Decide o foco ao abrir a sala. A sala só conta como "já focada" quando a
 * pessoa pode enviar: sem permissão o campo nem existe, e se a permissão
 * chegar depois (cargos carregando), o foco vem nessa hora.
 */
export function composerFocusPlan(input: {
  room: string
  /** Última sala em que o foco automático já foi decidido. */
  focusedRoom: string | null
  canSend: boolean
  finePointer: boolean
  /** Outro campo de texto está com o foco (busca, modal…). */
  typingElsewhere: boolean
}): { focus: boolean; focusedRoom: string | null } {
  if (!input.canSend || input.room === input.focusedRoom) {
    return { focus: false, focusedRoom: input.focusedRoom }
  }
  return { focus: input.finePointer && !input.typingElsewhere, focusedRoom: input.room }
}

/** O ponteiro principal é fino (mouse, trackpad)? Sem matchMedia, trata como toque. */
export function hasFinePointer(win: {
  matchMedia?: (query: string) => { matches: boolean }
}): boolean {
  return win.matchMedia?.('(pointer: fine)').matches ?? false
}

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** Elemento em que a pessoa digita (campo, área de texto ou contenteditable). */
export function isTextField(el: { tagName: string; isContentEditable?: boolean } | null): boolean {
  return Boolean(el && (TEXT_TAGS.has(el.tagName) || el.isContentEditable))
}
