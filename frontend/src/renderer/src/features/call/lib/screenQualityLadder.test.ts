import { describe, expect, it } from 'vitest'
import { qualityLabel, qualityLadder } from './screenQualityLadder'

const q = (resolution: '720p' | '1080p' | 'source', frameRate: 30 | 60) => ({
  resolution,
  frameRate
})
const uhd = { width: 3840, height: 2160 }
const fullHd = { width: 1920, height: 1080 }

describe('qualityLadder', () => {
  it('60 fps: desce a resolução antes do fps (renditions da Twitch), piso 720p30', () => {
    expect(qualityLadder(q('source', 60), uhd)).toEqual([
      q('source', 60),
      q('1080p', 60),
      q('720p', 60),
      q('720p', 30)
    ])
    expect(qualityLadder(q('1080p', 60), uhd)).toEqual([q('1080p', 60), q('720p', 60), q('720p', 30)])
  })

  it('30 fps (texto): só desce a resolução', () => {
    expect(qualityLadder(q('1080p', 30), uhd)).toEqual([q('1080p', 30), q('720p', 30)])
    expect(qualityLadder(q('720p', 30), uhd)).toEqual([q('720p', 30)])
  })

  it('Fonte numa tela 1080p não repete o degrau de 1080p', () => {
    expect(qualityLadder(q('source', 60), fullHd)).toEqual([
      q('source', 60),
      q('720p', 60),
      q('720p', 30)
    ])
  })

  it('com a camada extra de 720p, o envio principal para em 1080p (a de 720p segura quem tem internet fraca)', () => {
    expect(qualityLadder(q('1080p', 60), uhd, true)).toEqual([q('1080p', 60), q('1080p', 30)])
    expect(qualityLadder(q('source', 60), uhd, true)).toEqual([
      q('source', 60),
      q('1080p', 60),
      q('1080p', 30)
    ])
  })
})

describe('qualityLabel', () => {
  it('nome curto do degrau, com a altura real da Fonte', () => {
    expect(qualityLabel(q('720p', 60))).toBe('720p 60')
    expect(qualityLabel(q('source', 30), { width: 2560, height: 1440 })).toBe('1440p 30')
    expect(qualityLabel(q('source', 30), uhd)).toBe('1440p 30')
    expect(qualityLabel(q('source', 60))).toBe('Fonte 60')
  })
})
