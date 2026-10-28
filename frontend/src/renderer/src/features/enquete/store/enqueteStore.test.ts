import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBadges = vi.hoisted(() => vi.fn())
vi.mock('../../levels/store/badgeStore', () => ({
  useBadgeStore: { getState: () => ({ ensureBadges }) }
}))
vi.mock('../api/enquete', () => ({
  fetchPendentes: vi.fn(),
  responderEnquete: vi.fn()
}))

import { ApiError } from '../../../shared/api/client'
import { fetchPendentes, responderEnquete, type Enquete } from '../api/enquete'
import { faseAtual } from '../lib/enquete'
import { useEnqueteStore } from './enqueteStore'

const fetchMock = vi.mocked(fetchPendentes)
const responderMock = vi.mocked(responderEnquete)

const enquete: Enquete = {
  id: 'segundo-turno',
  titulo: 'T',
  descricao: 'D',
  opcoes: [
    { id: 'l', rotulo: 'L', badge: 'l' },
    { id: '22', rotulo: '22', badge: 'v22' },
    { id: 'nulo', rotulo: 'Nulo', badge: 'nulo' }
  ]
}
const outra: Enquete = { ...enquete, id: 'outra' }

const estado = (): ReturnType<typeof useEnqueteStore.getState> => useEnqueteStore.getState()

async function ate(opcao: string): Promise<void> {
  await estado().carregar('ana')
  estado().selecionar(opcao)
  estado().continuar()
  expect(estado().etapa).toBe('confirmacao')
}

describe('enqueteStore', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    responderMock.mockReset()
    ensureBadges.mockReset()
    ensureBadges.mockResolvedValue(undefined)
    fetchMock.mockResolvedValue([enquete])
    estado().reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('carrega as pendentes uma vez por pessoa', async () => {
    await estado().carregar('ana')
    await estado().carregar('ana')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(estado().pendentes).toEqual([enquete])
  })

  it('troca de pessoa descarta o estado da anterior', async () => {
    await estado().carregar('ana')
    estado().selecionar('l')
    fetchMock.mockResolvedValue([])
    await estado().carregar('bia')
    expect(estado().pendentes).toEqual([])
    expect(estado().selecao).toBeNull()
  })

  it('sem pendentes (já respondeu ou fora do corte) nada aparece', async () => {
    fetchMock.mockResolvedValue([])
    await estado().carregar('ana')
    expect(estado().pendentes).toEqual([])
  })

  it('erro ao carregar deixa sem modal e carregar de novo tenta outra vez (foco da janela)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValueOnce(new Error('sem rede'))
    await estado().carregar('ana')
    expect(estado().pendentes).toEqual([])
    await estado().carregar('ana')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(estado().pendentes).toEqual([enquete])
  })

  it('continuar sem opção marcada não sai da pergunta; voltar mantém a escolha', async () => {
    await estado().carregar('ana')
    estado().continuar()
    expect(estado().etapa).toBe('pergunta')
    estado().selecionar('l')
    estado().continuar()
    expect(estado().etapa).toBe('confirmacao')
    estado().voltar()
    expect(estado().etapa).toBe('pergunta')
    expect(estado().selecao).toBe('l')
  })

  it('selecionar ignora opção que a enquete não tem', async () => {
    await estado().carregar('ana')
    estado().selecionar('zzz')
    expect(estado().selecao).toBeNull()
  })

  it('confirmar opção com badge: celebra, tira a enquete e recarrega os badges', async () => {
    await ate('22')
    responderMock.mockResolvedValue({ enquete: 'segundo-turno', opcao: '22', badge: 'v22' })
    await estado().confirmar()
    expect(responderMock).toHaveBeenCalledWith('segundo-turno', '22')
    expect(estado().reacao).toEqual({ tipo: 'celebracao', badge: 'v22', rotulo: 'Fez o 22' })
    expect(estado().pendentes).toEqual([])
    expect(estado().etapa).toBe('pergunta')
    expect(estado().selecao).toBeNull()
    expect(estado().enviando).toBe(false)
    expect(estado().erro).toBe(false)
    expect(ensureBadges).toHaveBeenCalledWith('ana', true)
  })

  it('confirmar "nulo": celebra o badge Votou Nulo e recarrega os badges', async () => {
    await ate('nulo')
    responderMock.mockResolvedValue({ enquete: 'segundo-turno', opcao: 'nulo', badge: 'nulo' })
    await estado().confirmar()
    expect(estado().reacao).toEqual({ tipo: 'celebracao', badge: 'nulo', rotulo: 'Votou Nulo' })
    expect(ensureBadges).toHaveBeenCalledWith('ana', true)
  })

  it('opção sem badge: aviso neutro e os badges ficam como estão', async () => {
    fetchMock.mockResolvedValue([{ ...enquete, opcoes: [{ id: 'pular', rotulo: 'Pular' }] }])
    await ate('pular')
    responderMock.mockResolvedValue({ enquete: 'segundo-turno', opcao: 'pular' })
    await estado().confirmar()
    expect(estado().reacao).toEqual({ tipo: 'neutra' })
    expect(ensureBadges).not.toHaveBeenCalled()
  })

  // Reset geral do segundo turno (migration 000096): o servidor apagou as
  // respostas, então quem já tinha respondido volta a ver a pergunta. O estado
  // vive só em memória (nada de "já respondi" em localStorage), então um app
  // novo, ou outro login, depende só do que o servidor devolver.
  it('depois do reset do servidor, quem já respondeu vê a pergunta de novo', async () => {
    await ate('22')
    responderMock.mockResolvedValue({ enquete: 'segundo-turno', opcao: '22', badge: 'v22' })
    await estado().confirmar()
    estado().fecharReacao()
    expect(faseAtual(estado())).toBe('oculto')

    estado().reset()
    await estado().carregar('ana')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(estado().pendentes).toEqual([enquete])
    expect(estado().selecao).toBeNull()
    expect(faseAtual(estado())).toBe('pergunta')
  })

  it('fecharReacao limpa a reação e mostra a próxima pendente', async () => {
    fetchMock.mockResolvedValue([enquete, outra])
    await ate('l')
    responderMock.mockResolvedValue({ enquete: 'segundo-turno', opcao: 'l', badge: 'l' })
    await estado().confirmar()
    expect(estado().pendentes).toEqual([outra])
    estado().fecharReacao()
    expect(estado().reacao).toBeNull()
    expect(estado().pendentes[0].id).toBe('outra')
  })

  it('falha ao enviar mantém a confirmação aberta, marca o erro e libera os botões', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await ate('l')
    responderMock.mockRejectedValue(new Error('sem rede'))
    await estado().confirmar()
    expect(estado().etapa).toBe('confirmacao')
    expect(estado().erro).toBe(true)
    expect(estado().enviando).toBe(false)
    expect(estado().reacao).toBeNull()
  })

  it.each([403, 404, 409])(
    '%i (servidor já decidiu) recarrega as pendentes em vez de mostrar erro',
    async (status) => {
      await ate('l')
      responderMock.mockRejectedValue(new ApiError(status, 'decidido'))
      fetchMock.mockResolvedValue([])
      await estado().confirmar()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(estado().erro).toBe(false)
      expect(estado().pendentes).toEqual([])
      expect(estado().reacao).toBeNull()
    }
  )

  it('carregar de novo para a mesma pessoa depois de responder não apaga a reação nem refaz o fetch', async () => {
    await ate('l')
    responderMock.mockResolvedValue({ enquete: 'segundo-turno', opcao: 'l', badge: 'l' })
    await estado().confirmar()
    await estado().carregar('ana')
    expect(estado().reacao).toEqual({ tipo: 'celebracao', badge: 'l', rotulo: 'Fez o L' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falha em ensureBadges é só logada: a celebração continua e não há erro', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    ensureBadges.mockRejectedValue(new Error('x'))
    await ate('l')
    responderMock.mockResolvedValue({ enquete: 'segundo-turno', opcao: 'l', badge: 'l' })
    await estado().confirmar()
    await vi.waitFor(() => expect(erro).toHaveBeenCalled())
    expect(estado().reacao).toEqual({ tipo: 'celebracao', badge: 'l', rotulo: 'Fez o L' })
    expect(estado().erro).toBe(false)
  })

  it('dois cliques seguidos em confirmar enviam uma vez só', async () => {
    await ate('l')
    let liberar: (v: { enquete: string; opcao: string; badge: string }) => void = () => {}
    responderMock.mockReturnValue(new Promise((r) => (liberar = r)))
    const a = estado().confirmar()
    const b = estado().confirmar()
    liberar({ enquete: 'segundo-turno', opcao: 'l', badge: 'l' })
    await Promise.all([a, b])
    expect(responderMock).toHaveBeenCalledTimes(1)
  })

  it('resposta que chega depois de trocar de pessoa é descartada', async () => {
    await ate('l')
    let liberar: (v: { enquete: string; opcao: string; badge: string }) => void = () => {}
    responderMock.mockReturnValue(new Promise((r) => (liberar = r)))
    const pendente = estado().confirmar()
    estado().reset()
    await estado().carregar('bia')
    liberar({ enquete: 'segundo-turno', opcao: 'l', badge: 'l' })
    await pendente
    expect(estado().reacao).toBeNull()
    expect(estado().pendentes).toEqual([enquete])
  })
})
