import { mediaSrc } from './mediaUrl'

describe('mediaSrc', () => {
  it('endereço absoluto passa direto', () => {
    expect(mediaSrc('https://cdn.exemplo.com/a.png')).toBe('https://cdn.exemplo.com/a.png')
  })

  it('caminho relativo ganha a origem do servidor', () => {
    expect(mediaSrc('/api/media/avatars/a.png')).toBe('http://localhost:8080/api/media/avatars/a.png')
  })

  it('sem endereço: null', () => {
    expect(mediaSrc(null)).toBeNull()
    expect(mediaSrc(undefined)).toBeNull()
    expect(mediaSrc('')).toBeNull()
  })
})
