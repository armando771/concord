import { describe, expect, it } from 'vitest'
import { serverIconSrc } from './serverIcon'

describe('serverIconSrc', () => {
  it('mantém ícone antigo guardado como URL externa', () => {
    expect(serverIconSrc('https://exemplo.com/i.png')).toBe('https://exemplo.com/i.png')
  })
  it('GIF enviado (a_) usa o arquivo animado, não o quadro parado', () => {
    const src = serverIconSrc('/api/profile-media/a_11111111-1111-4111-8111-111111111111')
    expect(src).toMatch(/\/api\/profile-media\/a_1111/)
    expect(src).not.toMatch(/static/)
  })
  it('sem ícone devolve undefined', () => {
    expect(serverIconSrc('')).toBeUndefined()
    expect(serverIconSrc(undefined)).toBeUndefined()
  })
})
