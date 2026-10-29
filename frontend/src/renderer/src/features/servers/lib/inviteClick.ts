import { parseOwnInviteUrl } from './inviteLink'

export interface LinkClick {
  /** href resolvido do <a> clicado (a.href), ou null se o clique não foi num link. */
  href: string | null
  button: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented: boolean
}

/**
 * Clique simples (botão esquerdo, sem teclas) num link de convite nosso →
 * código; qualquer outro clique, null e o link segue o caminho normal. Ctrl,
 * Shift e botão do meio continuam significando "abrir em outra aba/janela"
 * (no app, o processo main trata esses casos pelo setWindowOpenHandler).
 */
export function inviteCodeFromClick(
  click: LinkClick,
  serverOrigins: readonly (string | undefined)[]
): string | null {
  if (click.defaultPrevented || !click.href) return null
  if (click.button !== 0) return null
  if (click.ctrlKey || click.metaKey || click.shiftKey || click.altKey) return null
  return parseOwnInviteUrl(click.href, serverOrigins)
}
