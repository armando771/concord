import { faseAtual } from '../lib/segundoTurno'
import { useSegundoTurnoStore } from '../store/segundoTurnoStore'

/** O botão da barra lateral: só existe com o banner dispensado e sem resposta. */
export function useBotaoSegundoTurno(): { visivel: boolean; reabrir: () => void } {
  const visivel = useSegundoTurnoStore((s) => faseAtual(s) === 'botao')
  const reabrir = useSegundoTurnoStore((s) => s.reabrir)
  return { visivel, reabrir }
}
