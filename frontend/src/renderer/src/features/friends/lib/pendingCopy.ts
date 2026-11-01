const COPY = {
  incoming: { subtitle: 'Pedido de amizade recebido', denyLabel: 'Recusar' },
  outgoing: { subtitle: 'Pedido de amizade enviado', denyLabel: 'Cancelar' }
} as const

/** Textos da linha de pedido: o recebido pode ser recusado, o enviado, cancelado. */
export function pendingCopy(incoming: boolean): { subtitle: string; denyLabel: string } {
  return incoming ? COPY.incoming : COPY.outgoing
}
