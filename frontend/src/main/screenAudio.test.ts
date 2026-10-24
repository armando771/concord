import { describe, expect, it } from 'vitest'
import { hwndFromSourceId, isReadyLine, PcmChunker } from './screenAudio'

describe('hwndFromSourceId', () => {
  it('extrai o HWND de uma fonte de janela', () => {
    expect(hwndFromSourceId('window:132456:0')).toBe('132456')
  })

  it('tela inteira não tem janela (usa o som do sistema)', () => {
    expect(hwndFromSourceId('screen:0:0')).toBeNull()
  })

  it('ignora ids estranhos', () => {
    expect(hwndFromSourceId('window:abc:0')).toBeNull()
    expect(hwndFromSourceId('window::0')).toBeNull()
    expect(hwndFromSourceId('')).toBeNull()
  })
})

describe('PcmChunker', () => {
  // 1 quadro = 2 canais × float32 = 8 bytes
  it('só entrega quadros inteiros e guarda o resto para o próximo pedaço', () => {
    const chunker = new PcmChunker(8)
    expect(chunker.push(Buffer.alloc(13)).length).toBe(8)
    expect(chunker.push(Buffer.alloc(3)).length).toBe(8)
    expect(chunker.push(Buffer.alloc(4)).length).toBe(0)
    expect(chunker.push(Buffer.alloc(4)).length).toBe(8)
  })

  it('mantém a ordem dos bytes entre pedaços', () => {
    const chunker = new PcmChunker(8)
    const first = chunker.push(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
    const second = chunker.push(Buffer.from([11, 12, 13, 14, 15, 16]))
    expect([...first]).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...second]).toEqual([9, 10, 11, 12, 13, 14, 15, 16])
  })
})

describe('isReadyLine', () => {
  it('reconhece o aviso de início do helper', () => {
    expect(isReadyLine('ready\n')).toBe(true)
    expect(isReadyLine('aviso qualquer\nready\r\n')).toBe(true)
  })

  it('não confunde erros que contêm "ready" (ex.: ALREADY_INITIALIZED)', () => {
    expect(isReadyLine('erro: AUDCLNT_E_ALREADY_INITIALIZED\n')).toBe(false)
    expect(isReadyLine('already running')).toBe(false)
  })
})
