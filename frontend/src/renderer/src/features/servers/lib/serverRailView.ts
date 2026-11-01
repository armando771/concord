import { railBadgeCount } from './serverRailBadge'

export interface ServerRailView {
  /** Ícone apagado (servidor silenciado sem nada a destacar). */
  dimmed: boolean
  /** Número do selo vermelho; 0 = sem selo. */
  badge: number
  /** Selo de voz: eu estou na call ('mine'), há gente nela ('active') ou nada. */
  voice: 'mine' | 'active' | null
}

// O que o ícone de um servidor na barra lateral mostra, a partir do estado bruto.
export function serverRailView(s: {
  muted: boolean
  isActive: boolean
  /** Contagens ainda não carregadas chegam undefined. */
  mentions: number | undefined
  unread: number | undefined
  inMyCall: boolean
  hasCall: boolean
}): ServerRailView {
  const mentions = s.mentions ?? 0
  const unread = s.muted ? 0 : (s.unread ?? 0)
  const voice = s.inMyCall ? 'mine' : s.hasCall ? 'active' : null
  return {
    dimmed: s.muted && !s.isActive && mentions === 0,
    badge: railBadgeCount(mentions, unread),
    voice
  }
}
