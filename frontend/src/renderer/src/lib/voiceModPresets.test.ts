import { describe, expect, it } from 'vitest'
import {
  clampIntensity,
  clampPitch,
  clampTimbre,
  isVoiceModActive,
  PRESET_ORDER,
  VOICE_MOD_PRESETS,
  voiceModParams,
  type VoiceModSettings
} from './voiceModPresets'

function settings(over: Partial<VoiceModSettings> = {}): VoiceModSettings {
  return { preset: 'normal', customized: false, pitch: 0, timbre: 0, intensity: 1, ...over }
}

describe('voiceModPresets', () => {
  it('tem os seis presets da v1, nesta ordem', () => {
    expect(PRESET_ORDER).toEqual(['normal', 'grave', 'esquilo', 'robo', 'eco', 'radio'])
    for (const id of PRESET_ORDER) expect(VOICE_MOD_PRESETS[id].label).toBeTruthy()
  })

  it('normal sem ajuste é bypass', () => {
    expect(voiceModParams(settings()).bypass).toBe(true)
    expect(isVoiceModActive(settings())).toBe(false)
  })

  it('normal com tom ou timbre ajustado deixa de ser bypass', () => {
    expect(isVoiceModActive(settings({ pitch: 3, customized: true }))).toBe(true)
    expect(isVoiceModActive(settings({ timbre: -0.2, customized: true }))).toBe(true)
  })

  it('preset com efeito nunca é bypass', () => {
    for (const preset of ['robo', 'eco', 'radio'] as const) {
      expect(isVoiceModActive(settings({ preset }))).toBe(true)
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

  it('cada efeito liga só o seu bloco', () => {
    expect(voiceModParams(settings({ preset: 'robo' }))).toMatchObject({
      ringHz: 50,
      echo: false,
      radio: false
    })
    expect(voiceModParams(settings({ preset: 'eco' }))).toMatchObject({
      ringHz: 0,
      echo: true,
      radio: false
    })
    expect(voiceModParams(settings({ preset: 'radio' }))).toMatchObject({
      ringHz: 0,
      echo: false,
      radio: true
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
