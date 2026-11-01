import { describe, expect, it, vi } from 'vitest'
import { initialFocusTarget, trapTab, wrapFocusIndex } from './focusTrap'

describe('wrapFocusIndex', () => {
  it('Tab no último volta para o primeiro; Shift+Tab no primeiro vai para o último', () => {
    expect(wrapFocusIndex(2, 3, false)).toBe(0)
    expect(wrapFocusIndex(0, 3, true)).toBe(2)
  })

  it('no meio, o navegador cuida', () => {
    expect(wrapFocusIndex(1, 3, false)).toBeNull()
    expect(wrapFocusIndex(1, 3, true)).toBeNull()
  })

  it('foco fora do diálogo entra pela ponta certa', () => {
    expect(wrapFocusIndex(-1, 3, false)).toBe(0)
    expect(wrapFocusIndex(-1, 3, true)).toBe(2)
  })

  it('sem nada focável, nada a fazer', () => {
    expect(wrapFocusIndex(-1, 0, false)).toBeNull()
  })
})

describe('initialFocusTarget', () => {
  const el = (name: string): HTMLElement => ({ name }) as unknown as HTMLElement
  const root = (marcado: HTMLElement | null, focaveis: HTMLElement[]): HTMLElement =>
    ({
      querySelector: () => marcado,
      querySelectorAll: () => focaveis
    }) as unknown as HTMLElement

  it('o elemento marcado com data-autofocus ganha o foco inicial', () => {
    const voltar = el('voltar')
    expect(initialFocusTarget(root(voltar, [el('confirmar'), voltar]))).toBe(voltar)
  })

  it('sem marcação, o primeiro focável', () => {
    const primeiro = el('primeiro')
    expect(initialFocusTarget(root(null, [primeiro, el('segundo')]))).toBe(primeiro)
  })

  it('sem nada focável, undefined', () => {
    expect(initialFocusTarget(root(null, []))).toBeUndefined()
  })
})

describe('trapTab', () => {
  const botao = (): HTMLElement => ({ focus: vi.fn() }) as unknown as HTMLElement
  const tecla = (key: string, shiftKey = false): KeyboardEvent =>
    ({ key, shiftKey, preventDefault: vi.fn() }) as unknown as KeyboardEvent
  const raiz = (itens: HTMLElement[]): HTMLElement =>
    ({ querySelectorAll: () => itens }) as unknown as HTMLElement

  it('Tab no último volta para o primeiro', () => {
    const [a, b] = [botao(), botao()]
    vi.stubGlobal('document', { activeElement: b })
    const e = tecla('Tab')
    trapTab(e, raiz([a, b]))
    expect(e.preventDefault).toHaveBeenCalled()
    expect(a.focus).toHaveBeenCalled()
  })

  it('outra tecla, ou sem raiz, não mexe no foco', () => {
    const a = botao()
    const e = tecla('Enter')
    trapTab(e, raiz([a]))
    trapTab(tecla('Tab'), null)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(a.focus).not.toHaveBeenCalled()
  })

  it('Tab no meio segue o navegador', () => {
    const [a, b, c] = [botao(), botao(), botao()]
    vi.stubGlobal('document', { activeElement: b })
    const e = tecla('Tab')
    trapTab(e, raiz([a, b, c]))
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})
