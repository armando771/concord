import { findInviteDeepLink, parseInviteDeepLink } from '../renderer/src/lib/inviteLink'

/**
 * Convite que chegou pelo salinha://convite/<código> e ainda não foi aberto.
 * O renderer busca (take) quando carrega e a cada aviso: assim nada se perde
 * se o link chega antes da janela (partida a frio) nem abre duas vezes.
 */
export class PendingInvite {
  private code: string | null = null

  /** Args do processo (partida a frio ou segunda instância). true se havia convite. */
  offerArgs(argv: readonly string[]): boolean {
    return this.keep(findInviteDeepLink(argv))
  }

  /** URL do open-url (macOS). */
  offerUrl(url: string): boolean {
    return this.keep(parseInviteDeepLink(url))
  }

  take(): string | null {
    const code = this.code
    this.code = null
    return code
  }

  private keep(code: string | null): boolean {
    if (!code) return false
    this.code = code
    return true
  }
}
