import { describe, expect, it, vi } from 'vitest'
import { openOnContextMenu } from './anchorMenu'

describe('openOnContextMenu', () => {
  it('tira o menu do navegador e abre o nosso ancorado no botão', () => {
    const onMenu = vi.fn()
    const preventDefault = vi.fn()
    const button = {} as HTMLElement
    openOnContextMenu(onMenu)({ preventDefault, currentTarget: button })
    expect(preventDefault).toHaveBeenCalled()
    expect(onMenu).toHaveBeenCalledWith(button)
  })
})
