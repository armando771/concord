import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { faseAtual } from '../lib/segundoTurno'
import { useSegundoTurnoStore } from '../store/segundoTurnoStore'
import SegundoTurnoBanner from './SegundoTurnoBanner'
import SegundoTurnoCelebracao from './SegundoTurnoCelebracao'
import SegundoTurnoTriste from './SegundoTurnoTriste'

/**
 * Carrega o estado de quem está logado e mostra o que a fase pede (banner ou
 * reação). O botão de reabrir mora na barra lateral.
 */
function SegundoTurnoHost(): React.JSX.Element | null {
  const userId = useAuthStore((s) => s.user?.id)
  const carregar = useSegundoTurnoStore((s) => s.carregar)
  const reset = useSegundoTurnoStore((s) => s.reset)
  const fase = useSegundoTurnoStore(faseAtual)

  useEffect(() => {
    if (userId) void carregar(userId)
    else reset()
  }, [userId, carregar, reset])

  // Falha de rede ao abrir o app: tenta de novo quando a janela volta ao foco
  // (sem custo se o estado já foi carregado).
  useEffect(() => {
    if (!userId) return
    const retry = (): void => void carregar(userId)
    window.addEventListener('focus', retry)
    return () => window.removeEventListener('focus', retry)
  }, [userId, carregar])

  if (fase === 'banner') return <SegundoTurnoBanner />
  if (fase === 'celebracao') return <SegundoTurnoCelebracao />
  if (fase === 'triste') return <SegundoTurnoTriste />
  return null
}

export default SegundoTurnoHost
