import { describe, expect, it } from 'vitest'
import {
  applyChromaKey,
  DEFAULT_CHROMA_KEY,
  hexToRgb,
  pickKeyColor,
  sanitizeChromaKey,
  type ChromaKeySettings
} from './chromaKey'

const settings = (over: Partial<ChromaKeySettings> = {}): ChromaKeySettings => ({
  ...DEFAULT_CHROMA_KEY,
  enabled: true,
  ...over
})

// Monta um buffer RGBA a partir de pixels [r, g, b].
function rgba(...px: [number, number, number][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(px.length * 4)
  px.forEach(([r, g, b], i) => out.set([r, g, b, 255], i * 4))
  return out
}

const GREEN: [number, number, number] = [0, 177, 64]
const SKIN: [number, number, number] = [224, 172, 140]
const BG: [number, number, number] = [30, 30, 30]

describe('hexToRgb', () => {
  it('converte #rrggbb e #rgb', () => {
    expect(hexToRgb('#00b140')).toEqual([0, 177, 64])
    expect(hexToRgb('#0f0')).toEqual([0, 255, 0])
  })
  it('devolve null para lixo', () => {
    expect(hexToRgb('verde')).toBeNull()
    expect(hexToRgb('#12345')).toBeNull()
    expect(hexToRgb('')).toBeNull()
  })
})

describe('sanitizeChromaKey', () => {
  it('devolve o padrão para entrada inválida', () => {
    expect(sanitizeChromaKey(null)).toEqual(DEFAULT_CHROMA_KEY)
    expect(sanitizeChromaKey('x')).toEqual(DEFAULT_CHROMA_KEY)
  })
  it('limita sliders a 0..1 e descarta cor inválida', () => {
    const s = sanitizeChromaKey({ similarity: 5, smoothness: -2, keyColor: 'zzz', enabled: 1 })
    expect(s.similarity).toBe(1)
    expect(s.smoothness).toBe(0)
    expect(s.keyColor).toBe(DEFAULT_CHROMA_KEY.keyColor)
    expect(s.enabled).toBe(false)
  })
  it('só aceita imagem como data URL de imagem', () => {
    expect(
      sanitizeChromaKey({ background: { mode: 'image', image: 'http://x/y.png' } }).background.image
    ).toBe('')
    expect(
      sanitizeChromaKey({ background: { mode: 'image', image: 'data:image/jpeg;base64,AAA' } })
        .background.image
    ).toBe('data:image/jpeg;base64,AAA')
  })
  it('modo imagem sem imagem volta para cor', () => {
    expect(sanitizeChromaKey({ background: { mode: 'image', image: '' } }).background.mode).toBe(
      'color'
    )
  })
})

describe('applyChromaKey', () => {
  it('troca o verde pelo fundo e mantém a pele', () => {
    const data = rgba(GREEN, SKIN)
    applyChromaKey(data, settings(), BG)
    expect([...data.slice(0, 4)]).toEqual([...BG, 255])
    expect([...data.slice(4, 8)]).toEqual([...SKIN, 255])
  })

  it('sensibilidade zero remove só a cor exata', () => {
    const near: [number, number, number] = [20, 170, 70]
    const data = rgba(near)
    applyChromaKey(data, settings({ keyColor: '#00b140', similarity: 0, smoothness: 0 }), BG)
    // Mantido (não virou o fundo); só o verde excedente é atenuado.
    expect([data[0], data[2]]).toEqual([near[0], near[2]])
    expect([...data.slice(0, 3)]).not.toEqual(BG)
  })

  it('sensibilidade alta remove tons próximos', () => {
    const near: [number, number, number] = [20, 170, 70]
    const data = rgba(near)
    applyChromaKey(data, settings({ keyColor: '#00b140', similarity: 0.6, smoothness: 0.05 }), BG)
    expect([...data.slice(0, 3)]).toEqual(BG)
  })

  it('suavidade gera mistura nas bordas', () => {
    const edge: [number, number, number] = [90, 170, 90]
    const data = rgba(edge)
    applyChromaKey(data, settings({ keyColor: '#00b140', similarity: 0.35, smoothness: 0.5 }), BG)
    const [r, g, b] = data
    const lo = Math.min(...BG, ...edge)
    const hi = Math.max(...BG, ...edge)
    expect([r, g, b].every((v) => v >= lo && v <= hi)).toBe(true)
    expect([r, g, b]).not.toEqual(edge)
    expect([r, g, b]).not.toEqual(BG)
  })

  it('funciona com chroma azul', () => {
    const blue: [number, number, number] = [0, 71, 187]
    const data = rgba(blue, SKIN)
    applyChromaKey(data, settings({ keyColor: '#0047bb' }), BG)
    expect([...data.slice(0, 3)]).toEqual(BG)
    expect([...data.slice(4, 7)]).toEqual(SKIN)
  })

  it('reduz o vazamento de verde nos pixels mantidos', () => {
    const spill: [number, number, number] = [200, 215, 190]
    const data = rgba(spill)
    applyChromaKey(data, settings({ keyColor: '#00b140', similarity: 0.2, smoothness: 0.05 }), BG)
    expect(data[1]).toBeLessThan(215)
  })

  it('aceita um fundo por pixel (imagem)', () => {
    const data = rgba(GREEN, GREEN)
    const bg = rgba([1, 2, 3], [4, 5, 6])
    applyChromaKey(data, settings(), bg)
    expect([...data.slice(0, 3)]).toEqual([1, 2, 3])
    expect([...data.slice(4, 7)]).toEqual([4, 5, 6])
  })

  it('buffer vazio não quebra e alfa continua opaco', () => {
    expect(() => applyChromaKey(new Uint8ClampedArray(0), settings(), BG)).not.toThrow()
    const data = rgba(GREEN)
    applyChromaKey(data, settings(), BG)
    expect(data[3]).toBe(255)
  })
})

describe('pickKeyColor', () => {
  it('lê a cor do pixel clicado como hex', () => {
    const data = rgba([0, 0, 0], GREEN, [0, 0, 0], [0, 0, 0])
    expect(pickKeyColor(data, 2, 1, 0)).toBe('#00b140')
  })
  it('fora dos limites devolve null', () => {
    expect(pickKeyColor(rgba(GREEN), 1, 5, 5)).toBeNull()
  })
})
