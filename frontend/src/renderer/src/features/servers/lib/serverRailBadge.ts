// Número do selo do servidor: menção ganha de não lida.
export function railBadgeCount(mentions: number, unread: number): number {
  return mentions > 0 ? mentions : unread
}

export function badgeText(n: number): string {
  return n > 99 ? '99+' : String(n)
}

// Selo de voz do servidor: eu estou na call ou só há gente nela.
export function voiceBadgeLabel(inMyCall: boolean): string {
  return inMyCall ? 'Em chamada' : 'Chamada em andamento'
}
