import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { faseAtual } from '../lib/enquete'
import { useEnqueteStore } from '../store/enqueteStore'
import EnqueteCelebracao from './EnqueteCelebracao'
import EnqueteConfirmacao from './EnqueteConfirmacao'
import EnqueteNeutra from './EnqueteNeutra'
import EnquetePergunta from './EnquetePergunta'

/**
 * Carrega as enquetes pendentes de quem está logado e mostra a primeira
 * (pergunta, confirmação ou a reação à resposta). Depois de responder, a
 * próxima pendente aparece sozinha.
 */
function EnqueteHost(): React.JSX.Element | null {
  const userId = useAuthStore((s) => s.user?.id)
  const carregar = useEnqueteStore((s) => s.carregar)
  const reset = useEnqueteStore((s) => s.reset)
  const fase = useEnqueteStore(faseAtual)
  const enquete = useEnqueteStore((s) => s.pendentes[0])
  const reacao = useEnqueteStore((s) => s.reacao)

  useEffect(() => {
    if (userId) void carregar(userId)
    else reset()
  }, [userId, carregar, reset])

  // Falha de rede ao abrir o app: tenta de novo quando a janela volta ao foco
  // (sem custo se as pendentes já foram carregadas).
  useEffect(() => {
    if (!userId) return
    const retry = (): void => void carregar(userId)
    window.addEventListener('focus', retry)
    return () => window.removeEventListener('focus', retry)
  }, [userId, carregar])

  if (reacao?.tipo === 'celebracao')
    return <EnqueteCelebracao badge={reacao.badge} rotulo={reacao.rotulo} />
  if (fase === 'neutra') return <EnqueteNeutra />
  if (!enquete) return null
  if (fase === 'pergunta') return <EnquetePergunta enquete={enquete} />
  if (fase === 'confirmacao') return <EnqueteConfirmacao enquete={enquete} />
  return null
}

export default EnqueteHost
