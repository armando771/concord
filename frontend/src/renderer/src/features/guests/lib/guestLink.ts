import { INVITE_WEB_ORIGIN } from '../../servers/lib/inviteLink'

/**
 * Link de visitante: https://app-salinha.bhrx.com.br/visitante/<token>. O
 * token tem 43 caracteres base64url (256 bits). Puro.
 */
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const WEB_PATH = /^\/visitante\/([A-Za-z0-9_-]{43})\/?$/

export function guestLink(token: string, origin: string = INVITE_WEB_ORIGIN): string {
  return `${origin}/visitante/${token}`
}

export function validGuestToken(token: string | undefined): token is string {
  return typeof token === 'string' && TOKEN.test(token)
}

/**
 * Link de visitante nosso clicado dentro do app → token (o app abre a tela do
 * visitante aqui, em vez do navegador). Só as origens dadas; null se não é.
 */
export function guestTokenFromUrl(
  raw: string,
  origins: readonly (string | undefined)[]
): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const allowed = new Set([new URL(INVITE_WEB_ORIGIN).origin, ...origins.filter(Boolean)])
  if (!allowed.has(url.origin) || url.username || url.password) return null
  return WEB_PATH.exec(url.pathname)?.[1] ?? null
}

/** O clique que o app trata: botão principal, sem tecla e não tratado antes. */
export interface LinkClick {
  href: string | null
  button: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  defaultPrevented: boolean
}

/** Clique num link de visitante nosso → token (o app abre a tela aqui); senão null. */
export function guestTokenFromClick(
  click: LinkClick,
  origins: readonly (string | undefined)[]
): string | null {
  const plain =
    click.button === 0 &&
    !click.ctrlKey &&
    !click.metaKey &&
    !click.shiftKey &&
    !click.defaultPrevented
  return plain && click.href ? guestTokenFromUrl(click.href, origins) : null
}
