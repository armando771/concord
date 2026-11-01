// Rotas que acendem o botão de início da barra lateral. Os convites de servidor
// moram na aba "Convites" de /friends; /invites é a rota antiga, que redireciona.
export function isHomePath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/friends' ||
    pathname === '/invites' ||
    pathname.startsWith('/dm/')
  )
}

// Selo do início: DMs não lidas + pedidos de amizade recebidos + convites de servidor.
export function dmUnreadTotal(
  conversations: { id: string }[],
  unreadByRoom: Record<string, number>,
  incomingRequests: number,
  serverInvites: number
): number {
  const dms = conversations.reduce(
    (sum, conv) => sum + (unreadByRoom[`conversation:${conv.id}`] ?? 0),
    0
  )
  return dms + incomingRequests + serverInvites
}
