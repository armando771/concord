import { describe, expect, it } from 'vitest'
import { channelBadge } from './channelBadge'

describe('channelBadge', () => {
  it('nada novo, sem selo', () => {
    expect(channelBadge(0, 0, false)).toBeNull()
  })

  it('não lidas contam', () => {
    expect(channelBadge(0, 3, false)).toEqual({ label: '3', mention: false })
  })

  it('menção ganha das não lidas', () => {
    expect(channelBadge(2, 7, false)).toEqual({ label: '2', mention: true })
  })

  it('canal silenciado só mostra menção', () => {
    expect(channelBadge(0, 5, true)).toBeNull()
    expect(channelBadge(1, 5, true)).toEqual({ label: '1', mention: true })
  })

  it('mais de 99 vira 99+', () => {
    expect(channelBadge(0, 150, false)?.label).toBe('99+')
  })
})
