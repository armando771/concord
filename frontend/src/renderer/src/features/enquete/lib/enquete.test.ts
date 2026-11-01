import { describe, expect, it } from 'vitest'
import type { Enquete } from '../api/enquete'
import { achaOpcao, faseAtual, reacaoDe } from './enquete'

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
  it('opção com badge celebra com o badge e o nome dele, não o rótulo curto da opção', () => {
    expect(reacaoDe(enquete.opcoes[0])).toEqual({
      tipo: 'celebracao',
      badge: 'l',
      rotulo: 'Fez o L'
    })
    expect(reacaoDe(enquete.opcoes[1])).toEqual({
      tipo: 'celebracao',
      badge: 'v22',
      rotulo: 'Fez o 22'
    })
    expect(reacaoDe(enquete.opcoes[2])).toEqual({
      tipo: 'celebracao',
      badge: 'nulo',
      rotulo: 'Votou Nulo'
    })
  })

  it('badge desconhecido celebra com o rótulo da opção', () => {
    expect(reacaoDe({ id: 'x', rotulo: 'Xis', badge: 'novo' })).toEqual({
      tipo: 'celebracao',
      badge: 'novo',
      rotulo: 'Xis'
    })
  })

  it('opção sem badge dá o aviso neutro', () => {
    expect(reacaoDe({ id: 'pular', rotulo: 'Pular' })).toEqual({ tipo: 'neutra' })
  })
})

describe('achaOpcao', () => {
  it('acha pelo id e devolve undefined se não existir', () => {
    expect(achaOpcao(enquete, '22')?.rotulo).toBe('22')
    expect(achaOpcao(enquete, 'zzz')).toBeUndefined()
    expect(achaOpcao(undefined, 'l')).toBeUndefined()
  })
})
