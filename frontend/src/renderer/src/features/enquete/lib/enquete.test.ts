import { describe, expect, it } from 'vitest'
import type { Enquete } from '../api/enquete'
import { achaOpcao, faseAtual, reacaoDe } from './enquete'

const enquete: Enquete = {
  id: 'segundo-turno',
  titulo: 'T',
  descricao: 'D',
  opcoes: [
    { id: 'l', rotulo: 'Fez o L', badge: 'l' },
    { id: '22', rotulo: 'Fez o 22', badge: 'v22' },
    { id: 'nenhum', rotulo: 'Prefiro não dizer' }
  ]
}

describe('faseAtual', () => {
  it('sem pendentes e sem reação, nada na tela', () => {
    expect(faseAtual({ pendentes: [], etapa: 'pergunta', reacao: null })).toBe('oculto')
  })

  it('com pendente mostra a etapa atual', () => {
    expect(faseAtual({ pendentes: [enquete], etapa: 'pergunta', reacao: null })).toBe('pergunta')
    expect(faseAtual({ pendentes: [enquete], etapa: 'confirmacao', reacao: null })).toBe(
      'confirmacao'
    )
  })

  it('a reação vem antes de tudo, mesmo com outra enquete pendente', () => {
    const celebracao = { tipo: 'celebracao', badge: 'l', rotulo: 'Fez o L' } as const
    expect(faseAtual({ pendentes: [enquete], etapa: 'pergunta', reacao: celebracao })).toBe(
      'celebracao'
    )
    expect(faseAtual({ pendentes: [], etapa: 'pergunta', reacao: { tipo: 'neutra' } })).toBe(
      'neutra'
    )
  })
})

describe('reacaoDe', () => {
  it('opção com badge celebra com o badge e o rótulo', () => {
    expect(reacaoDe(enquete.opcoes[1])).toEqual({
      tipo: 'celebracao',
      badge: 'v22',
      rotulo: 'Fez o 22'
    })
  })

  it('opção sem badge dá o aviso neutro', () => {
    expect(reacaoDe(enquete.opcoes[2])).toEqual({ tipo: 'neutra' })
  })
})

describe('achaOpcao', () => {
  it('acha pelo id e devolve undefined se não existir', () => {
    expect(achaOpcao(enquete, '22')?.rotulo).toBe('Fez o 22')
    expect(achaOpcao(enquete, 'zzz')).toBeUndefined()
    expect(achaOpcao(undefined, 'l')).toBeUndefined()
  })
})
