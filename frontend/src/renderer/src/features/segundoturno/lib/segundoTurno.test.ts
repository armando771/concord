import { describe, expect, it, vi } from 'vitest'
import {
  chaveDispensa,
  faseAtual,
  gravarDispensa,
  lerDispensa,
  type EntradaFase
} from './segundoTurno'

const elegivel = { elegivel: true, respondeu: false, fez_o_l: false }

function entrada(over: Partial<EntradaFase> = {}): EntradaFase {
  return { estado: elegivel, dispensado: false, reacao: null, ...over }
}

describe('faseAtual', () => {
  it('sem estado carregado, nada na tela', () => {
    expect(faseAtual(entrada({ estado: null }))).toBe('oculto')
  })

  it('conta fora do corte não vê banner nem botão', () => {
    const estado = { ...elegivel, elegivel: false }
    expect(faseAtual(entrada({ estado }))).toBe('oculto')
    expect(faseAtual(entrada({ estado, dispensado: true }))).toBe('oculto')
  })

  it('elegível e sem resposta vê o banner; dispensado vira o botão', () => {
    expect(faseAtual(entrada())).toBe('banner')
    expect(faseAtual(entrada({ dispensado: true }))).toBe('botao')
  })

  it('quem já respondeu não vê mais nada, nem o botão', () => {
    const estado = { elegivel: true, respondeu: true, fez_o_l: true }
    expect(faseAtual(entrada({ estado }))).toBe('oculto')
    expect(faseAtual(entrada({ estado, dispensado: true }))).toBe('oculto')
  })

  it('a reação ao responder vem antes de tudo, mesmo com o estado já respondido', () => {
    const estado = { elegivel: true, respondeu: true, fez_o_l: true }
    expect(faseAtual(entrada({ estado, reacao: 'sim' }))).toBe('celebracao')
    expect(faseAtual(entrada({ estado, reacao: 'nao', dispensado: true }))).toBe('triste')
  })
})

describe('dispensa guardada por pessoa', () => {
  function memoria(): Pick<Storage, 'getItem' | 'setItem'> {
    const dados = new Map<string, string>()
    return {
      getItem: (k) => dados.get(k) ?? null,
      setItem: (k, v) => void dados.set(k, v)
    }
  }

  it('grava e lê só para a mesma pessoa', () => {
    const storage = memoria()
    expect(lerDispensa('ana', storage)).toBe(false)
    gravarDispensa('ana', storage)
    expect(lerDispensa('ana', storage)).toBe(true)
    expect(lerDispensa('bia', storage)).toBe(false)
    expect(chaveDispensa('ana')).not.toBe(chaveDispensa('bia'))
  })

  it('storage bloqueado não derruba: lê como não dispensado e grava sem erro', () => {
    const quebrado = {
      getItem: vi.fn(() => {
        throw new Error('bloqueado')
      }),
      setItem: vi.fn(() => {
        throw new Error('bloqueado')
      })
    }
    expect(lerDispensa('ana', quebrado)).toBe(false)
    expect(() => gravarDispensa('ana', quebrado)).not.toThrow()
  })

  it('sem localStorage no ambiente também não derruba', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(lerDispensa('ana')).toBe(false)
    expect(() => gravarDispensa('ana')).not.toThrow()
    vi.unstubAllGlobals()
  })
})
