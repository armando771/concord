import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIDEO_BACKGROUND,
  MAX_CUSTOM_BACKGROUNDS,
  PRESET_BACKGROUNDS,
  needsPipeline,
  resolveBackgroundEffect,
  resolveBackgroundImage,
  sameBackground,
  sanitizeBackground,
  sanitizeCustomBackgrounds,
  type BackgroundPreset,
  type CustomBackground,
  type VideoBackground
} from './videoBackground'

const presets: BackgroundPreset[] = [
  { id: 'aurora', label: 'Aurora', dataUrl: 'data:image/svg+xml,a' }
]
const customs: CustomBackground[] = [{ id: 'c1', dataUrl: 'data:image/jpeg;base64,AAA' }]
const preset: VideoBackground = { mode: 'image', image: { kind: 'preset', id: 'aurora' } }
const custom: VideoBackground = { mode: 'image', image: { kind: 'custom', id: 'c1' } }

describe('PRESET_BACKGROUNDS', () => {
  it('traz as imagens do app como data URL, com nome em português', () => {
    expect(PRESET_BACKGROUNDS.length).toBeGreaterThanOrEqual(8)
    for (const p of PRESET_BACKGROUNDS) {
      expect(p.dataUrl.startsWith('data:image/svg+xml')).toBe(true)
      expect(p.label).toBeTruthy()
    }
    expect(PRESET_BACKGROUNDS.find((p) => p.id === 'cidade-neon')?.label).toBe('Cidade neon')
  })
  it('ids únicos', () => {
    const ids = PRESET_BACKGROUNDS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('sanitizeBackground', () => {
  it('lixo vira "nenhum"', () => {
    expect(sanitizeBackground(null)).toEqual(DEFAULT_VIDEO_BACKGROUND)
    expect(sanitizeBackground('x')).toEqual(DEFAULT_VIDEO_BACKGROUND)
    expect(sanitizeBackground({ mode: 'roxo' })).toEqual(DEFAULT_VIDEO_BACKGROUND)
  })
  it('mantém desfoque e imagem válidos', () => {
    expect(sanitizeBackground({ mode: 'blur' }).mode).toBe('blur')
    expect(sanitizeBackground(preset)).toEqual(preset)
  })
  it('modo imagem sem imagem escolhida vira "nenhum"', () => {
    expect(sanitizeBackground({ mode: 'image', image: null }).mode).toBe('none')
    expect(sanitizeBackground({ mode: 'image', image: { kind: 'x', id: 'a' } }).mode).toBe('none')
    expect(sanitizeBackground({ mode: 'image', image: { kind: 'preset', id: '' } }).mode).toBe(
      'none'
    )
  })
})

describe('sanitizeCustomBackgrounds', () => {
  it('só aceita data URL de imagem, sem repetir id', () => {
    const out = sanitizeCustomBackgrounds([
      { id: 'a', dataUrl: 'data:image/jpeg;base64,AA' },
      { id: 'a', dataUrl: 'data:image/jpeg;base64,BB' },
      { id: 'b', dataUrl: 'http://x/y.png' },
      { id: '', dataUrl: 'data:image/png;base64,CC' },
      null,
      { id: 'c', dataUrl: 'data:image/png;base64,CC' }
    ])
    expect(out.map((i) => i.id)).toEqual(['a', 'c'])
  })
  it('GIF salvo guarda só o registro (o arquivo está no IndexedDB)', () => {
    const out = sanitizeCustomBackgrounds([
      { id: 'g1', dataUrl: 'blob:http://x/abc', animated: true },
      { id: 'g1', animated: true },
      { id: 'g2', animated: 'sim', dataUrl: 'http://x' }
    ])
    expect(out).toEqual([{ id: 'g1', dataUrl: '', animated: true }])
  })
  it('respeita o limite', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `i${i}`,
      dataUrl: 'data:image/jpeg;base64,A'
    }))
    expect(sanitizeCustomBackgrounds(many)).toHaveLength(MAX_CUSTOM_BACKGROUNDS)
  })
  it('não-lista vira lista vazia', () => {
    expect(sanitizeCustomBackgrounds({})).toEqual([])
  })
})

describe('resolveBackgroundImage / needsPipeline', () => {
  it('resolve pronta e salva', () => {
    expect(resolveBackgroundImage(preset, customs, presets)).toBe('data:image/svg+xml,a')
    expect(resolveBackgroundImage(custom, customs, presets)).toBe('data:image/jpeg;base64,AAA')
  })
  it('GIF que ainda não carregou do IndexedDB não resolve; carregado resolve e liga o pipeline', () => {
    const gif: VideoBackground = { mode: 'image', image: { kind: 'custom', id: 'g1' } }
    const loading: CustomBackground[] = [{ id: 'g1', dataUrl: '', animated: true }]
    const loaded: CustomBackground[] = [{ id: 'g1', dataUrl: 'blob:http://x/abc', animated: true }]
    expect(resolveBackgroundImage(gif, loading, presets)).toBeNull()
    expect(needsPipeline(gif, loading, presets)).toBe(false)
    expect(resolveBackgroundImage(gif, loaded, presets)).toBe('blob:http://x/abc')
    expect(needsPipeline(gif, loaded, presets)).toBe(true)
  })
  it('imagem que sumiu não resolve', () => {
    expect(resolveBackgroundImage(custom, [], presets)).toBeNull()
    expect(resolveBackgroundImage({ mode: 'blur', image: null }, customs, presets)).toBeNull()
  })
  it('nenhum não processa; desfoque e imagem válida sim', () => {
    expect(needsPipeline(DEFAULT_VIDEO_BACKGROUND, customs, presets)).toBe(false)
    expect(needsPipeline({ mode: 'blur', image: null }, customs, presets)).toBe(true)
    expect(needsPipeline(preset, customs, presets)).toBe(true)
  })
  it('imagem apagada não liga o pipeline à toa', () => {
    expect(needsPipeline(custom, [], presets)).toBe(false)
  })
})

describe('resolveBackgroundEffect', () => {
  it('desfoque e nenhum não levam imagem', () => {
    expect(resolveBackgroundEffect({ mode: 'blur', image: null }, customs, presets)).toEqual({
      mode: 'blur',
      image: null,
      blob: null
    })
    expect(resolveBackgroundEffect(DEFAULT_VIDEO_BACKGROUND, customs, presets).mode).toBe('none')
  })
  it('imagem pronta: data URL, sem blob', () => {
    expect(resolveBackgroundEffect(preset, customs, presets)).toEqual({
      mode: 'image',
      image: 'data:image/svg+xml,a',
      blob: null
    })
  })
  it('GIF salvo leva o arquivo junto (os quadros saem dele)', () => {
    const blob = { size: 3 } as unknown as Blob
    const gif: CustomBackground[] = [{ id: 'g1', dataUrl: 'blob:x', animated: true, blob }]
    const bg: VideoBackground = { mode: 'image', image: { kind: 'custom', id: 'g1' } }
    expect(resolveBackgroundEffect(bg, gif, presets)).toEqual({
      mode: 'image',
      image: 'blob:x',
      blob
    })
  })
  it('GIF ainda carregando não resolve imagem nem blob', () => {
    const gif: CustomBackground[] = [{ id: 'g1', dataUrl: '', animated: true }]
    const bg: VideoBackground = { mode: 'image', image: { kind: 'custom', id: 'g1' } }
    expect(resolveBackgroundEffect(bg, gif, presets)).toEqual({
      mode: 'image',
      image: null,
      blob: null
    })
  })
})

describe('sameBackground', () => {
  it('compara modo e imagem', () => {
    expect(sameBackground(preset, { ...preset })).toBe(true)
    expect(sameBackground(preset, custom)).toBe(false)
    expect(sameBackground(DEFAULT_VIDEO_BACKGROUND, { mode: 'blur', image: null })).toBe(false)
  })
})
