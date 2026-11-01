/** Selo vermelho de um canal na barra de canais. */
export interface ChannelBadge {
  label: string
  /** É contagem de menções (não só de não lidas). */
  mention: boolean
}

/**
 * Menção ganha das não lidas; canal silenciado só mostra menção. Acima de 99
 * vira "99+". Sem nada novo, sem selo.
 */
export function channelBadge(
  mentions: number,
  unread: number,
  muted: boolean
): ChannelBadge | null {
  const n = mentions > 0 ? mentions : muted ? 0 : unread
  if (n <= 0) return null
  return { label: n > 99 ? '99+' : String(n), mention: mentions > 0 }
}
