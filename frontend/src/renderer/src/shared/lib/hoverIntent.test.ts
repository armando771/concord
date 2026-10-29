import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHoverIntent, type HoverIntent } from './hoverIntent'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(): { intent: HoverIntent; onOpenChange: ReturnType<typeof vi.fn> } {
  const onOpenChange = vi.fn()
  const intent = createHoverIntent({ openDelay: 150, closeDelay: 200, onOpenChange })
  return { intent, onOpenChange }
}

describe('hoverIntent', () => {
  it('abre só depois do atraso de entrada', () => {
    const { intent, onOpenChange } = setup()
    intent.enter()
    vi.advanceTimersByTime(149)
    expect(onOpenChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('não abre se o ponteiro sai antes do atraso', () => {
    const { intent, onOpenChange } = setup()
    intent.enter()
    vi.advanceTimersByTime(50)
    intent.leave()
    vi.advanceTimersByTime(1000)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(onOpenChange).not.toHaveBeenCalledWith(true)
  })

  it('fecha só depois do atraso de saída', () => {
    const { intent, onOpenChange } = setup()
    intent.show()
    intent.leave()
    vi.advanceTimersByTime(199)
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    vi.advanceTimersByTime(1)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('voltar antes de fechar mantém o painel aberto (atravessar até as opções)', () => {
    const { intent, onOpenChange } = setup()
    intent.show()
    intent.leave()
    vi.advanceTimersByTime(100)
    intent.enter()
    vi.advanceTimersByTime(1000)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('show e close agem na hora e cancelam o agendamento', () => {
    const { intent, onOpenChange } = setup()
    intent.enter()
    intent.show()
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    intent.leave()
    intent.close()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    vi.advanceTimersByTime(1000)
    expect(onOpenChange.mock.calls).toEqual([[true], [false]])
  })

  it('cancel interrompe o que estava agendado', () => {
    const { intent, onOpenChange } = setup()
    intent.enter()
    intent.cancel()
    vi.advanceTimersByTime(1000)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('leave aceita um atraso próprio, mais longo, para a travessia na diagonal', () => {
    const { intent, onOpenChange } = setup()
    intent.show()
    intent.leave(500)
    vi.advanceTimersByTime(499)
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    vi.advanceTimersByTime(1)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })
})
