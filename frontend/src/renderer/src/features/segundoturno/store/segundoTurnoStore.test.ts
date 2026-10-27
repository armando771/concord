import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBadges = vi.hoisted(() => vi.fn())
vi.mock('../../levels/store/badgeStore', () => ({
  useBadgeStore: { getState: () => ({ ensureBadges }) }
}))
vi.mock('../api/segundoTurno', () => ({
  fetchSegundoTurno: vi.fn(),
  responderSegundoTurno: vi.fn()
}))

import { ApiError } from '../../../shared/api/client'
import { fetchSegundoTurno, responderSegundoTurno } from '../api/segundoTurno'
import { chaveDispensa } from '../lib/segundoTurno'
import { useSegundoTurnoStore } from './segundoTurnoStore'

const fetchMock = vi.mocked(fetchSegundoTurno)
const responderMock = vi.mocked(responderSegundoTurno)
const elegivel = { elegivel: true, respondeu: false, fez_o_l: false }
const respondido = (fezOL: boolean): typeof elegivel => ({
  elegivel: true,
  respondeu: true,
  fez_o_l: fezOL
})

function storageEmMemoria(): void {
  const dados = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v)
  })
}

const estado = (): ReturnType<typeof useSegundoTurnoStore.getState> =>
  useSegundoTurnoStore.getState()

describe('segundoTurnoStore', () => {
  beforeEach(() => {
    storageEmMemoria()
    fetchMock.mockReset()
    responderMock.mockReset()
    ensureBadges.mockReset()
    fetchMock.mockResolvedValue(elegivel)
    estado().reset()
  })

  it('carrega o estado uma vez por pessoa', async () => {
    await estado().carregar('ana')
    await estado().carregar('ana')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(estado().estado).toEqual(elegivel)
  })

  it('troca de pessoa descarta o estado e a dispensa da anterior', async () => {
    await estado().carregar('ana')
    estado().dispensar()
    expect(estado().dispensado).toBe(true)

    fetchMock.mockResolvedValue(respondido(false))
    await estado().carregar('bia')
    expect(estado().dispensado).toBe(false)
    expect(estado().estado?.respondeu).toBe(true)
  })

  it('a dispensa sobrevive a um novo carregamento (outra sessão do app)', async () => {
    await estado().carregar('ana')
    estado().dispensar()
    estado().reset()
    await estado().carregar('ana')
    expect(estado().dispensado).toBe(true)
    expect(localStorage.getItem(chaveDispensa('ana'))).not.toBeNull()
  })

  it('reabrir tira a dispensa só desta sessão; ao abrir o app de novo o banner volta a ser dispensado', async () => {
    await estado().carregar('ana')
    estado().dispensar()
    estado().reabrir()
    expect(estado().dispensado).toBe(false)
    estado().reset()
    await estado().carregar('ana')
    expect(estado().dispensado).toBe(true)
  })

  it('erro ao carregar deixa sem banner, sem derrubar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValue(new Error('sem rede'))
    await estado().carregar('ana')
    expect(estado().estado).toBeNull()
  })

  it('carregar de novo depois de uma falha busca outra vez (janela voltou ao foco)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValueOnce(new Error('sem rede'))
    await estado().carregar('ana')
    expect(estado().estado).toBeNull()
    await estado().carregar('ana')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(estado().estado).toEqual(elegivel)
  })

  it('responder sim guarda a resposta e abre a celebração', async () => {
    await estado().carregar('ana')
    responderMock.mockResolvedValue(respondido(true))
    await estado().responder(true)
    expect(responderMock).toHaveBeenCalledWith(true)
    expect(estado().reacao).toBe('sim')
    expect(estado().estado?.respondeu).toBe(true)
    expect(estado().enviando).toBe(false)
  })

  it('responder sim recarrega os badges de quem respondeu, sem esperar o aviso do servidor', async () => {
    await estado().carregar('ana')
    responderMock.mockResolvedValue(respondido(true))
    await estado().responder(true)
    expect(ensureBadges).toHaveBeenCalledWith('ana', true)
  })

  it('responder não deixa os badges como estão', async () => {
    await estado().carregar('ana')
    responderMock.mockResolvedValue(respondido(false))
    await estado().responder(false)
    expect(ensureBadges).not.toHaveBeenCalled()
  })

  it('responder não abre a reação triste', async () => {
    await estado().carregar('ana')
    responderMock.mockResolvedValue(respondido(false))
    await estado().responder(false)
    expect(estado().reacao).toBe('nao')
  })

  it('fecharReacao limpa a reação', async () => {
    await estado().carregar('ana')
    responderMock.mockResolvedValue(respondido(true))
    await estado().responder(true)
    estado().fecharReacao()
    expect(estado().reacao).toBeNull()
  })

  it('falha ao enviar mantém o banner, marca o erro e libera os botões', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await estado().carregar('ana')
    responderMock.mockRejectedValue(new Error('sem rede'))
    await estado().responder(true)
    expect(estado().reacao).toBeNull()
    expect(estado().erro).toBe(true)
    expect(estado().enviando).toBe(false)
    expect(estado().estado?.respondeu).toBe(false)
  })

  it('409 (respondeu em outro aparelho) recarrega o estado em vez de mostrar erro', async () => {
    await estado().carregar('ana')
    responderMock.mockRejectedValue(new ApiError(409, 'already answered'))
    fetchMock.mockResolvedValue(respondido(false))
    await estado().responder(true)
    expect(estado().erro).toBe(false)
    expect(estado().estado?.respondeu).toBe(true)
    expect(estado().reacao).toBeNull()
  })

  it('dois cliques seguidos enviam uma vez só', async () => {
    await estado().carregar('ana')
    let liberar: (v: typeof elegivel) => void = () => {}
    responderMock.mockReturnValue(new Promise((r) => (liberar = r)))
    const a = estado().responder(true)
    const b = estado().responder(true)
    liberar(respondido(true))
    await Promise.all([a, b])
    expect(responderMock).toHaveBeenCalledTimes(1)
  })

  it('resposta que chega depois de trocar de pessoa é descartada', async () => {
    await estado().carregar('ana')
    let liberar: (v: typeof elegivel) => void = () => {}
    responderMock.mockReturnValue(new Promise((r) => (liberar = r)))
    const pendente = estado().responder(true)
    estado().reset()
    await estado().carregar('bia')
    liberar(respondido(true))
    await pendente
    expect(estado().reacao).toBeNull()
    expect(estado().estado?.respondeu).toBe(false)
  })
})
