import { describe, expect, it } from 'vitest'
import {
  emotePickerPlacement,
  emotePickerStyle,
  measureEmotePicker,
  scrollParentOf
} from './emotePickerPlacement'

// Lista que rola de 0 a 600 px; o seletor tem 300 px de altura.
const box = { containerTop: 0, containerBottom: 600, height: 300 }

describe('emotePickerPlacement', () => {
  it('com espaço embaixo, abre para baixo como sempre', () => {
    expect(emotePickerPlacement({ ...box, rowTop: 100 })).toEqual({ side: 'below', maxHeight: null })
  })

  // Regressão: na última mensagem ele abria para baixo e ficava cortado atrás
  // do campo de mensagem (só a busca e "FREQUENTES" apareciam).
  it('na última mensagem (sem espaço embaixo), abre para cima da barra de ações', () => {
    expect(emotePickerPlacement({ ...box, rowTop: 540 })).toEqual({ side: 'above', maxHeight: null })
  })

  it('mede dentro da lista que rola, não da janela', () => {
    // A lista começa em 200 e termina em 700: a linha em 520 tem 180 px embaixo.
    const placed = emotePickerPlacement({ containerTop: 200, containerBottom: 700, height: 300, rowTop: 520 })
    expect(placed.side).toBe('above')
  })

  it('sem caber em nenhum lado, fica no maior e limita a altura', () => {
    const placed = emotePickerPlacement({ containerTop: 0, containerBottom: 400, height: 300, rowTop: 250 })
    expect(placed.side).toBe('above')
    expect(placed.maxHeight).toBeGreaterThan(0)
    expect(placed.maxHeight).toBeLessThan(300)
  })

  it('limite de altura nunca fica menor que o mínimo usável', () => {
    const placed = emotePickerPlacement({ containerTop: 0, containerBottom: 120, height: 300, rowTop: 40 })
    expect(placed.maxHeight).toBe(140)
  })
})

describe('emotePickerStyle', () => {
  it('para baixo: logo abaixo da barra de ações', () => {
    expect(emotePickerStyle({ side: 'below', maxHeight: null })).toEqual({ top: 32, bottom: 'auto' })
  })

  it('para cima: a base acima da barra, com a altura limitada quando precisa', () => {
    expect(emotePickerStyle({ side: 'above', maxHeight: 200 })).toEqual({
      top: 'auto',
      bottom: 'calc(100% + 20px)',
      maxHeight: 200
    })
  })
})

describe('scrollParentOf', () => {
  type Node = { name: string; parentElement: Node | null }
  const chain = (...names: string[]): Node => {
    let parent: Node | null = null
    for (const name of names.reverse()) parent = { name, parentElement: parent }
    return parent as Node
  }

  it('acha o primeiro ancestral que rola na vertical', () => {
    const el = chain('picker', 'row', 'list', 'pane')
    const overflow: Record<string, string> = { list: 'auto', pane: 'hidden' }
    expect(scrollParentOf(el, (n) => overflow[n.name] ?? 'visible')?.name).toBe('list')
  })

  it('sem ancestral que role, null (vale a janela)', () => {
    expect(scrollParentOf(chain('picker', 'row'), () => 'visible')).toBeNull()
  })
})

describe('measureEmotePicker', () => {
  const rect = (top: number, bottom: number) => () => ({ top, bottom })
  // Lista que rola de 100 a 700 numa janela de 800; linha da mensagem em `rowTop`.
  function picker(rowTop: number) {
    const list = { getBoundingClientRect: rect(100, 700), parentElement: null, name: 'list' }
    const row = { getBoundingClientRect: rect(rowTop, rowTop + 40), parentElement: list }
    return { offsetHeight: 300, offsetParent: row, parentElement: row, getBoundingClientRect: rect(0, 0) }
  }
  const view = (mobile = false) => ({
    mobile,
    height: 800,
    overflowY: (n: object) => ('name' in n && n.name === 'list' ? 'auto' : 'visible')
  })

  it('regressão: na última mensagem da lista o seletor abre para cima', () => {
    expect(measureEmotePicker(picker(640), view())).toEqual({
      top: 'auto',
      bottom: 'calc(100% + 20px)'
    })
  })

  it('no meio da lista, abre para baixo', () => {
    expect(measureEmotePicker(picker(150), view())).toEqual({ top: 32, bottom: 'auto' })
  })

  it('no celular (folha de baixo) ou sem linha de referência, não mexe', () => {
    expect(measureEmotePicker(picker(640), view(true))).toBeUndefined()
    expect(measureEmotePicker(null, view())).toBeUndefined()
    expect(measureEmotePicker({ ...picker(640), offsetParent: null }, view())).toBeUndefined()
  })
})
