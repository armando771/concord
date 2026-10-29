import { describe, expect, it, vi } from 'vitest'
import { isActivationKey, rowInteraction } from './rowInteraction'

describe('rowInteraction', () => {
  it('sem clique a linha é inerte', () => {
    expect(rowInteraction()).toEqual({ className: '' })
  })
  it('com clique vira botão focável', () => {
    const r = rowInteraction(() => {})
    expect(r).toMatchObject({ role: 'button', tabIndex: 0, className: 'cursor-pointer' })
  })
  it('Enter e espaço disparam o clique', () => {
    const onClick = vi.fn()
    const preventDefault = vi.fn()
    const r = rowInteraction(onClick)
    r.onKeyDown?.({ key: 'Enter', preventDefault })
    r.onKeyDown?.({ key: ' ', preventDefault })
    expect(onClick).toHaveBeenCalledTimes(2)
    expect(preventDefault).toHaveBeenCalledTimes(2)
  })
  it('outras teclas são ignoradas', () => {
    const onClick = vi.fn()
    rowInteraction(onClick).onKeyDown?.({ key: 'a', preventDefault: vi.fn() })
    expect(onClick).not.toHaveBeenCalled()
  })
  it('isActivationKey', () => {
    expect(isActivationKey('Escape')).toBe(false)
  })
})
