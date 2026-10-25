import type { CallStatus } from '../store/callStore'

/**
 * Navegador: fechar ou recarregar a aba derruba a chamada (no desktop, fechar
 * esconde na bandeja). Com chamada em andamento, o navegador pede confirmação.
 */
export function shouldConfirmLeave(status: CallStatus): boolean {
  return status === 'active' || status === 'outgoing'
}
