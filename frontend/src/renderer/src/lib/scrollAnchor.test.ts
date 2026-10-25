import { describe, expect, it } from 'vitest'
import { anchoredScrollTop, contentOffset, olderPagePrepended, pickAnchor } from './scrollAnchor'

// Scroller com topo na tela em y=100. A mensagem âncora (a antiga primeira)
// está 40px abaixo do topo visível, rolada 0.
const SCROLLER_TOP = 100

describe('contentOffset', () => {
  it('é a posição no conteúdo, igual com qualquer rolagem', () => {
    expect(contentOffset(140, SCROLLER_TOP, 0)).toBe(40)
    // Rolou 300px: o elemento subiu 300px na tela, a posição no conteúdo não muda.
    expect(contentOffset(-160, SCROLLER_TOP, 300)).toBe(40)
  })
})

describe('anchoredScrollTop', () => {
  const saved = contentOffset(140, SCROLLER_TOP, 0) // 40

  it('página antiga em cima: rola exatamente a altura que entrou acima da âncora', () => {
    // 2000px entraram acima; scrollTop continua 0 (overflow-anchor: none).
    const now = contentOffset(2140, SCROLLER_TOP, 0)
    const top = anchoredScrollTop(0, saved, now)
    expect(top).toBe(2000)
    // Depois de rolar, a âncora volta para y=140 na tela.
    expect(now - top + SCROLLER_TOP).toBe(140)
  })

  it('mensagem ao vivo embaixo durante a espera não entra na conta', () => {
    // Página antiga (2000px) + mensagem nova (80px) embaixo: só o que está
    // acima da âncora muda a posição dela.
    const now = contentOffset(2140, SCROLLER_TOP, 0)
    expect(anchoredScrollTop(0, saved, now)).toBe(2000)
  })

  it('rolagem da pessoa durante a espera é mantida (não volta para o clique)', () => {
    // Rolou 250px para baixo esperando; a página entra depois.
    const scrolled = 250
    const now = contentOffset(2140 - scrolled, SCROLLER_TOP, scrolled)
    const top = anchoredScrollTop(scrolled, saved, now)
    expect(top).toBe(2250)
    // A âncora fica 250px acima de onde estava no clique, como a pessoa deixou.
    expect(now - top + SCROLLER_TOP).toBe(140 - scrolled)
  })

  it('sem nada novo acima não mexe', () => {
    expect(anchoredScrollTop(500, saved, saved)).toBe(500)
  })
})

describe('pickAnchor', () => {
  const candidates = [
    { id: 'a', offset: 40 },
    { id: 'b', offset: 120 },
    { id: 'c', offset: 200 }
  ]

  it('usa a antiga primeira quando ela continua na tela', () => {
    expect(pickAnchor(candidates, () => true)).toEqual({ id: 'a', offset: 40 })
  })

  it('apagada durante o carregamento: usa a seguinte que sobrou', () => {
    expect(pickAnchor(candidates, (id) => id !== 'a')).toEqual({ id: 'b', offset: 120 })
    expect(pickAnchor(candidates, (id) => id === 'c')).toEqual({ id: 'c', offset: 200 })
  })

  it('a reserva mantém a tela parada mesmo com a primeira apagada', () => {
    // 'a' (80px) foi apagada e 2000px de página antiga entraram em cima:
    // 'b' está em 120 - 80 + 2000 no conteúdo.
    const kept = pickAnchor(candidates, (id) => id !== 'a')!
    const now = 120 - 80 + 2000
    const top = anchoredScrollTop(0, kept.offset, now)
    expect(now - top).toBe(120) // mesma posição na tela do clique
  })

  it('nenhuma sobrou: sem âncora', () => {
    expect(pickAnchor(candidates, () => false)).toBeNull()
  })
})

describe('olderPagePrepended', () => {
  const candidates = [
    { id: 'a', offset: 40 },
    { id: 'b', offset: 120 }
  ]

  it('nova primeira de fora da lista: entrou página antiga', () => {
    expect(olderPagePrepended('z', candidates)).toBe(true)
  })

  it('a primeira continua a mesma (mensagem ao vivo embaixo): nada a fazer', () => {
    expect(olderPagePrepended('a', candidates)).toBe(false)
  })

  it('só sumiu a de cima (apagada): a âncora espera a página', () => {
    expect(olderPagePrepended('b', candidates)).toBe(false)
  })

  it('lista vazia: nada a fazer', () => {
    expect(olderPagePrepended(undefined, candidates)).toBe(false)
  })
})
