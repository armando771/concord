import { describe, expect, it, vi } from 'vitest'
import { createModalStack } from './modalStack'
import { attachModal, type AttachModalOptions } from './modalBehavior'

type Focusable = { focus: ReturnType<typeof vi.fn> }

function keydown(key: string): Event & { key: string } {
  return Object.assign(new Event('keydown', { cancelable: true }), { key })
}

function setup(over: Partial<AttachModalOptions> = {}): {
  win: EventTarget
  close: ReturnType<typeof vi.fn>
  first: Focusable
  previous: Focusable & { isConnected: boolean }
  doc: { activeElement: unknown }
  detach: () => void
  options: AttachModalOptions
} {
  const win = new EventTarget()
  const close = vi.fn()
  const first: Focusable = { focus: vi.fn() }
  const previous = { focus: vi.fn(), isConnected: true }
  const doc = { activeElement: previous as unknown }
  const root = {
    contains: (el: unknown) => el === first,
    querySelectorAll: () => [first]
  }
  const options: AttachModalOptions = {
    id: 'm1',
    win,
    doc: doc as unknown as Document,
    stack: createModalStack(),
    getRoot: () => root as unknown as HTMLElement,
    close,
    canClose: () => true,
    ...over
  }
  const detach = attachModal(options)
  return { win, close, first, previous, doc, detach, options }
}

describe('attachModal', () => {
  it('Esc fecha o modal do topo e marca o evento como tratado', () => {
    const t = setup()
    const e = keydown('Escape')
    t.win.dispatchEvent(e)
    expect(t.close).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it('outras teclas não fecham', () => {
    const t = setup()
    t.win.dispatchEvent(keydown('Enter'))
    expect(t.close).not.toHaveBeenCalled()
  })

  it('com outro modal por cima, o de baixo não fecha com o Esc', () => {
    const t = setup()
    t.options.stack.push('m2')
    t.win.dispatchEvent(keydown('Escape'))
    expect(t.close).not.toHaveBeenCalled()
  })

  it('quando o de cima sai, o Esc volta a fechar o de baixo', () => {
    const t = setup()
    t.options.stack.push('m2')
    t.options.stack.remove('m2')
    t.win.dispatchEvent(keydown('Escape'))
    expect(t.close).toHaveBeenCalledTimes(1)
  })

  it('modal que não pode fechar (ex.: enviando) ignora o Esc', () => {
    const t = setup({ canClose: () => false })
    t.win.dispatchEvent(keydown('Escape'))
    expect(t.close).not.toHaveBeenCalled()
  })

  it('Esc que alguém já tratou (defaultPrevented) não fecha', () => {
    const t = setup()
    const e = keydown('Escape')
    e.preventDefault()
    t.win.dispatchEvent(e)
    expect(t.close).not.toHaveBeenCalled()
  })

  it('ao abrir, o foco vai para o primeiro item do diálogo', () => {
    const t = setup()
    expect(t.first.focus).toHaveBeenCalledTimes(1)
  })

  it('não rouba o foco de quem já está dentro (autoFocus)', () => {
    const first: Focusable = { focus: vi.fn() }
    const doc = { activeElement: first }
    const root = { contains: (el: unknown) => el === first, querySelectorAll: () => [first] }
    attachModal({
      id: 'm',
      win: new EventTarget(),
      doc: doc as unknown as Document,
      stack: createModalStack(),
      getRoot: () => root as unknown as HTMLElement,
      close: () => {},
      canClose: () => true
    })
    expect(first.focus).not.toHaveBeenCalled()
  })

  it('ao fechar, o foco volta para onde estava e o Esc deixa de valer', () => {
    const t = setup()
    t.detach()
    expect(t.previous.focus).toHaveBeenCalledTimes(1)
    t.win.dispatchEvent(keydown('Escape'))
    expect(t.close).not.toHaveBeenCalled()
  })

  it('não devolve o foco a um elemento que saiu da tela', () => {
    const t = setup()
    t.previous.isConnected = false
    t.detach()
    expect(t.previous.focus).not.toHaveBeenCalled()
  })
})
