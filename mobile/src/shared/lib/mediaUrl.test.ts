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

  it('GIF animado (a_<id>) anima por padrão e pede o quadro parado com animate: false', () => {
    expect(mediaSrc('/api/profile-media/a_1')).toBe('http://localhost:8080/api/profile-media/a_1')
    expect(mediaSrc('/api/profile-media/a_1', { animate: false })).toBe('http://localhost:8080/api/profile-media/a_1/static')
  })

  it('o quadro parado entra antes da query string', () => {
    expect(mediaSrc('/api/profile-media/a_1?v=2', { animate: false })).toBe(
      'http://localhost:8080/api/profile-media/a_1/static?v=2'
    )
  })

  it('imagem que não anima fica igual nos dois modos', () => {
    expect(mediaSrc('/api/profile-media/abc', { animate: false })).toBe('http://localhost:8080/api/profile-media/abc')
  })

  it('arquivo local (prévia ainda não salva) volta como está', () => {
    for (const uri of ['file:///cache/a_1.gif', 'content://media/1', 'blob:http://x/1', 'data:image/png;base64,AA']) {
      expect(mediaSrc(uri, { animate: false })).toBe(uri)
    }
  })
})
