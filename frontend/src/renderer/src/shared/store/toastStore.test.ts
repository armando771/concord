import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXIT_MS, showToast, useToastStore } from './toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => vi.useRealTimers())

  it('não repete toast com mesmo tipo e mensagem já visível', () => {
    const a = showToast.error('Falhou')
    const b = showToast.error('Falhou')
    expect(b).toBe(a)
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('mensagens ou tipos diferentes continuam aparecendo', () => {
    showToast.error('Falhou')
    showToast.success('Falhou')
    showToast.error('Outra')
    expect(useToastStore.getState().toasts).toHaveLength(3)
  })

  it('aceita o tipo alerta', () => {
    showToast.warning('Cuidado')
    expect(useToastStore.getState().toasts[0].type).toBe('warning')
  })

  it('removeToast marca como saindo e só tira da lista após a animação', () => {
    const id = showToast.info('Oi')
    useToastStore.getState().removeToast(id)
    expect(useToastStore.getState().toasts[0].leaving).toBe(true)
    vi.advanceTimersByTime(EXIT_MS)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('o mesmo conteúdo pode voltar depois que o anterior começou a sair', () => {
    const id = showToast.info('Oi')
    useToastStore.getState().removeToast(id)
    const novo = showToast.info('Oi')
    expect(novo).not.toBe(id)
  })

  it('some sozinho após a duração', () => {
    showToast.success('Ok', 1000)
    vi.advanceTimersByTime(1000 + EXIT_MS)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
