import { describe, expect, it } from 'vitest'
import {
  clampIntensity,
  clampPitch,
  clampTimbre,
  isVoiceModActive,
  OPEN_HIGHPASS_HZ,
  OPEN_LOWPASS_HZ,
  PRESET_ORDER,
  VOICE_MOD_PRESETS,
  voiceModParams,
  type VoiceModPreset,
  type VoiceModSettings
} from './voiceModPresets'

function settings(over: Partial<VoiceModSettings> = {}): VoiceModSettings {
  return { preset: 'normal', customized: false, pitch: 0, timbre: 0, intensity: 1, ...over }
}

/** Parâmetros do preset como ele vem (sliders nos valores do próprio preset). */
function presetParams(preset: VoiceModPreset): ReturnType<typeof voiceModParams> {
  return voiceModParams(settings({ preset, ...VOICE_MOD_PRESETS[preset].values }))
}

describe('voiceModPresets', () => {
  it('tem os seis presets da v1 e os seis novos, nesta ordem', () => {
    expect(PRESET_ORDER).toEqual([
      'normal',
      'grave',
      'esquilo',
      'robo',
      'eco',
      'radio',
      'monstro',
      'alien',
      'caverna',
      'fantasma',
      'telefone',
      'megafone'
    ])
    for (const id of PRESET_ORDER) expect(VOICE_MOD_PRESETS[id].label).toBeTruthy()
  })

  it('todo preset está na ordem (nenhum fica fora da grade)', () => {
    expect(new Set(PRESET_ORDER)).toEqual(new Set(Object.keys(VOICE_MOD_PRESETS)))
  })

  it('normal sem ajuste é bypass, sem seco nem processado', () => {
    const p = voiceModParams(settings())
    expect(p.bypass).toBe(true)
    expect(p.dry).toBe(0)
    expect(p.wet).toBe(0)
    expect(isVoiceModActive(settings())).toBe(false)
  })

  it('normal com tom ou timbre ajustado deixa de ser bypass', () => {
    expect(isVoiceModActive(settings({ pitch: 3, customized: true }))).toBe(true)
    expect(isVoiceModActive(settings({ timbre: -0.2, customized: true }))).toBe(true)
  })

  it('preset com efeito nunca é bypass, mesmo com tom e timbre zerados', () => {
    const withEffect = PRESET_ORDER.filter((id) => !['normal', 'grave', 'esquilo'].includes(id))
    for (const preset of withEffect) {
      expect(isVoiceModActive(settings({ preset })), preset).toBe(true)
    }
  })

  it('converte semitons em razão de pitch', () => {
    expect(voiceModParams(settings({ pitch: 12 })).pitchRatio).toBeCloseTo(2, 5)
    expect(voiceModParams(settings({ pitch: -12 })).pitchRatio).toBeCloseTo(0.5, 5)
    expect(voiceModParams(settings({ pitch: 0 })).pitchRatio).toBe(1)
  })

  it('timbre negativo engrossa (graves sobem, agudos descem) e positivo afina', () => {
    const thick = voiceModParams(settings({ timbre: -1 }))
    expect(thick.lowShelfDb).toBeCloseTo(8, 5)
    expect(thick.highShelfDb).toBeCloseTo(-8, 5)
    const thin = voiceModParams(settings({ timbre: 1 }))
    expect(thin.lowShelfDb).toBeCloseTo(-8, 5)
    expect(thin.highShelfDb).toBeCloseTo(8, 5)
  })

  it('intensidade divide seco e processado', () => {
    const p = voiceModParams(settings({ pitch: 5, intensity: 0.25 }))
    expect(p.dry).toBeCloseTo(0.75, 5)
    expect(p.wet).toBeCloseTo(0.25, 5)
  })

  it('sem efeito, todos os blocos ficam neutros (filtros abertos)', () => {
    expect(voiceModParams(settings({ preset: 'grave', pitch: -5 }))).toMatchObject({
      modHz: 0,
      modDepth: 0,
      vibratoHz: 0,
      vibratoSemitones: 0,
      highpassHz: OPEN_HIGHPASS_HZ,
      lowpassHz: OPEN_LOWPASS_HZ,
      drive: 0,
      echo: 0,
      reverb: 0
    })
  })

  it('os sliders continuam valendo por cima do efeito do preset', () => {
    const p = voiceModParams(settings({ preset: 'caverna', pitch: 4, timbre: 1, intensity: 0.5 }))
    expect(p.reverb).toBeGreaterThan(0)
    expect(p.pitchRatio).toBeCloseTo(2 ** (4 / 12), 5)
    expect(p.highShelfDb).toBeCloseTo(8, 5)
    expect(p.wet).toBeCloseTo(0.5, 5)
  })

  describe('presets da v1 mantêm o som', () => {
    it('robô: modulação em anel de 50 Hz, profundidade total', () => {
      expect(presetParams('robo')).toMatchObject({ modHz: 50, modDepth: 1, echo: 0, drive: 0 })
    })

    it('eco: só o eco', () => {
      expect(presetParams('eco')).toMatchObject({ echo: 0.6, modHz: 0, reverb: 0, drive: 0 })
    })

    it('rádio: banda de 300–3400 Hz com saturação 3', () => {
      expect(presetParams('radio')).toMatchObject({
        highpassHz: 300,
        lowpassHz: 3400,
        drive: 3,
        echo: 0,
        modHz: 0
      })
    })
  })

  describe('presets novos', () => {
    it('monstro: bem grave, grosso e com distorção leve', () => {
      const p = presetParams('monstro')
      expect(p.pitchRatio).toBeLessThan(2 ** (-7 / 12))
      expect(p.lowShelfDb).toBeGreaterThan(0)
      expect(p.drive).toBeGreaterThan(0)
      expect(p.drive).toBeLessThan(presetParams('radio').drive)
      expect(p.highpassHz).toBe(OPEN_HIGHPASS_HZ)
    })

    it('alien: agudo, com vibrato e modulação parcial (não vira robô)', () => {
      const p = presetParams('alien')
      expect(p.pitchRatio).toBeGreaterThan(1)
      expect(p.vibratoHz).toBeGreaterThan(0)
      expect(p.vibratoSemitones).toBeGreaterThan(0)
      expect(p.modHz).toBeGreaterThan(0)
      expect(p.modDepth).toBeGreaterThan(0)
      expect(p.modDepth).toBeLessThan(1)
    })

    it('caverna: reverb forte sem mexer no tom', () => {
      const p = presetParams('caverna')
      expect(p.reverb).toBeGreaterThanOrEqual(0.5)
      expect(p.pitchRatio).toBe(1)
      expect(p.echo).toBe(0)
      expect(p.modHz).toBe(0)
    })

    it('fantasma: reverb, tom levemente grave e tremolo lento', () => {
      const p = presetParams('fantasma')
      expect(p.reverb).toBeGreaterThan(0)
      expect(p.pitchRatio).toBeLessThan(1)
      expect(p.pitchRatio).toBeGreaterThan(2 ** (-5 / 12))
      expect(p.modHz).toBeGreaterThan(0)
      expect(p.modHz).toBeLessThan(10)
      expect(p.modDepth).toBeLessThanOrEqual(0.5)
    })

    it('telefone: banda mais estreita que a do rádio e saturação mais leve', () => {
      const tel = presetParams('telefone')
      const radio = presetParams('radio')
      expect(tel.highpassHz).toBeGreaterThan(radio.highpassHz)
      expect(tel.lowpassHz).toBeLessThan(radio.lowpassHz)
      expect(tel.drive).toBeLessThan(radio.drive)
    })

    it('megafone: banda alta e a saturação mais forte', () => {
      const p = presetParams('megafone')
      expect(p.highpassHz).toBeGreaterThan(presetParams('radio').highpassHz)
      expect(p.lowpassHz).toBeLessThan(OPEN_LOWPASS_HZ)
      for (const other of PRESET_ORDER.filter((id) => id !== 'megafone')) {
        expect(p.drive, other).toBeGreaterThan(presetParams(other).drive)
      }
    })
  })

  it('limites dos sliders', () => {
    expect(clampPitch(40)).toBe(12)
    expect(clampPitch(-40)).toBe(-12)
    expect(clampTimbre(3)).toBe(1)
    expect(clampTimbre(-3)).toBe(-1)
    expect(clampIntensity(2)).toBe(1)
    expect(clampIntensity(-1)).toBe(0)
  })
})
