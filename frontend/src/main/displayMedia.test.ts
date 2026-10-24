import { describe, expect, it } from 'vitest'
import { displayMediaStreams } from './displayMedia'

const source = { id: 'screen:0:0', name: 'Tela inteira' }

describe('displayMediaStreams', () => {
  it('inclui o som do sistema (loopback) no Windows quando a página pede áudio', () => {
    expect(displayMediaStreams(source, true, 'win32')).toEqual({ video: source, audio: 'loopback' })
  })

  it('não pede áudio quando a página não pediu', () => {
    expect(displayMediaStreams(source, false, 'win32')).toEqual({ video: source })
  })

  it('só vídeo fora do Windows (loopback não é suportado)', () => {
    expect(displayMediaStreams(source, true, 'linux')).toEqual({ video: source })
    expect(displayMediaStreams(source, true, 'darwin')).toEqual({ video: source })
  })
})
