import { describe, expect, it } from 'vitest'
import { rightColumnFor, serverLayoutClasses } from './serverLayout'

const closed = { searchOpen: false, voiceChatOpen: false, wide: true }

describe('rightColumnFor', () => {
  it('por padrão, a lista de membros', () => {
    expect(rightColumnFor(closed)).toBe('members')
  })

  it('chat da call aberto em tela larga: ele toma a coluna da direita', () => {
    expect(rightColumnFor({ ...closed, voiceChatOpen: true })).toBe('voiceChat')
  })

  it('chat da call em tela estreita é sobreposição: a coluna continua a de membros', () => {
    expect(rightColumnFor({ ...closed, voiceChatOpen: true, wide: false })).toBe('members')
  })

  it('busca aberta ganha (resultados à direita), até do chat da call', () => {
    expect(rightColumnFor({ ...closed, searchOpen: true })).toBe('search')
    expect(rightColumnFor({ ...closed, searchOpen: true, voiceChatOpen: true })).toBe('search')
  })
})

describe('serverLayoutClasses', () => {
  it('membros: a barra atravessa as duas colunas e a busca ocupa a de membros do lg em diante', () => {
    const c = serverLayoutClasses('members')
    expect(c.header).toContain('col-span-2')
    expect(c.header).toContain('grid-cols-subgrid')
    expect(c.search).toContain('lg:contain-inline-size')
    // Abaixo do lg os membros somem: o conteúdo usa a largura toda.
    expect(c.content).toContain('col-span-2 ')
    expect(c.content).toContain('lg:col-span-1')
    expect(c.right).toContain('hidden')
    expect(c.right).toContain('lg:flex')
    expect(c.right).toContain('row-start-2')
  })

  it('resultados da busca: a busca fica em cima deles, em qualquer largura', () => {
    const c = serverLayoutClasses('search')
    expect(c.header).toContain('col-span-2')
    expect(c.search).toMatch(/(^| )contain-inline-size/)
    expect(c.content).toContain('col-start-1')
    expect(c.right).not.toContain('hidden')
  })

  it('chat da call: coluna da direita de cima a baixo; a barra fica só sobre a chamada', () => {
    const c = serverLayoutClasses('voiceChat')
    expect(c.header).toContain('col-start-1')
    expect(c.header).not.toContain('col-span-2')
    expect(c.search).not.toContain('contain-inline-size')
    expect(c.right).toContain('row-span-2')
    expect(c.right).toContain('row-start-1')
  })
})
