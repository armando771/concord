import { describe, expect, it } from 'vitest'
import { callAvatarAnimate } from './callAvatarMotion'

describe('callAvatarAnimate', () => {
  it('falando, o GIF anima', () => {
    expect(callAvatarAnimate({ background: false, speaking: true })).toBe('always')
  })

  it('calado, fica no quadro parado e anima com o mouse/foco em cima', () => {
    expect(callAvatarAnimate({ background: false, speaking: false })).toBe('hover')
  })

  it('app em segundo plano: parado sempre, mesmo falando', () => {
    expect(callAvatarAnimate({ background: true, speaking: true })).toBe('never')
    expect(callAvatarAnimate({ background: true, speaking: false })).toBe('never')
  })
})
