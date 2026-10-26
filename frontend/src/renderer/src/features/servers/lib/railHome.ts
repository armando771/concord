// Rotas que acendem o botão de início da barra lateral.
export function isHomePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/friends' || pathname.startsWith('/dm/')
}

// Selo do início: DMs não lidas + pedidos de amizade recebidos.
export function dmUnreadTotal(
  conversations: { id: string }[],
  unreadByRoom: Record<string, number>,
  incomingRequests: number
): number {
  const dms = conversations.reduce(
    (sum, conv) => sum + (unreadByRoom[`conversation:${conv.id}`] ?? 0),
    0
  )
  return dms + incomingRequests
}
