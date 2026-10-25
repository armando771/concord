import { describe, expect, it } from 'vitest'
import { canPublishSource } from './mediaPermissions'

describe('canPublishSource', () => {
  it('sem permissões conhecidas, assume que pode', () => {
    expect(canPublishSource(undefined, 'microphone')).toBe(true)
    expect(canPublishSource(null, 'screen_share')).toBe(true)
  })

  it('canPublish falso bloqueia tudo', () => {
    expect(canPublishSource({ canPublish: false, canPublishSources: [2] }, 'microphone')).toBe(
      false
    )
  })

  it('só as fontes listadas', () => {
    const noMic = { canPublish: true, canPublishSources: [1, 3, 4] } // câmera, tela, som da tela
    expect(canPublishSource(noMic, 'microphone')).toBe(false)
    expect(canPublishSource(noMic, 'camera')).toBe(true)
    expect(canPublishSource(noMic, 'screen_share')).toBe(true)
    expect(canPublishSource(noMic, 'screen_share_audio')).toBe(true)

    const onlyMic = { canPublish: true, canPublishSources: [2] }
    expect(canPublishSource(onlyMic, 'microphone')).toBe(true)
    expect(canPublishSource(onlyMic, 'camera')).toBe(false)
    expect(canPublishSource(onlyMic, 'screen_share')).toBe(false)
  })

  it('lista vazia com canPublish liberado = sem restrição por fonte', () => {
    expect(canPublishSource({ canPublish: true, canPublishSources: [] }, 'camera')).toBe(true)
    expect(canPublishSource({ canPublish: true }, 'microphone')).toBe(true)
  })
})
