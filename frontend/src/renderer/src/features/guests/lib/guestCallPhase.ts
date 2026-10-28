/** Em que pé está a call do visitante. Puro. */
export type GuestCallPhase = 'connecting' | 'active' | 'left'

/**
 * Conectado = na call; já esteve (ou a entrada falhou) e não está mais = saiu
 * (mostra "Voltar para a call"); senão, entrando.
 */
export function guestCallPhase(status: string, tried: boolean): GuestCallPhase {
  if (status === 'active') return 'active'
  if (tried && status === 'idle') return 'left'
  return 'connecting'
}

/** O acesso do servidor da call depois de mudanças (mover troca o canal). */
export function passOfServer<T extends { server_id: string }>(
  passes: T[],
  serverId: string
): T | null {
  return passes.find((p) => p.server_id === serverId) ?? null
}
