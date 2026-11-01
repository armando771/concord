import { describe, expect, it, vi } from 'vitest'
import { RemoteSubscriptions, type RemoteParticipantLike } from './remoteSubscriptions'

const paused = (windowHidden: boolean, offscreen: string[] = []) => ({
  windowHidden,
  offscreen: new Set(offscreen)
})

function publication(source: string, kind: 'audio' | 'video', desired = false) {
  const pub = {
    source,
    kind,
    isDesired: desired,
    setSubscribed: vi.fn((v: boolean) => {
      pub.isDesired = v
    }),
    setEnabled: vi.fn()
  }
  return pub
}

function participant(
  identity: string,
  pubs: ReturnType<typeof publication>[]
): RemoteParticipantLike {
  return { identity, trackPublications: new Map(pubs.map((p, i) => [String(i), p])) }
}

describe('RemoteSubscriptions', () => {
  it('voz e câmera sempre; tela só de quem estou assistindo', () => {
    const mic = publication('microphone', 'audio')
    const screen = publication('screen_share', 'video')
    const subs = new RemoteSubscriptions()
    subs.apply([participant('bia', [mic, screen])])
    expect(mic.setSubscribed).toHaveBeenCalledWith(true)
    expect(screen.setSubscribed).not.toHaveBeenCalled()
    subs.setWatched(['bia'])
    subs.apply([participant('bia', [mic, screen])])
    expect(screen.setSubscribed).toHaveBeenCalledWith(true)
  })

  it('janela fora da tela: pausa o vídeo (tela e câmera) e mantém o som', () => {
    const screen = publication('screen_share', 'video')
    const screenAudio = publication('screen_share_audio', 'audio')
    const camera = publication('camera', 'video')
    const people = [participant('bia', [screen, screenAudio, camera])]
    const subs = new RemoteSubscriptions()
    subs.setWatched(['bia'])
    subs.setPause(paused(true))
    subs.apply(people)
    expect(screen.setEnabled).toHaveBeenLastCalledWith(false)
    expect(camera.setEnabled).toHaveBeenLastCalledWith(false)
    expect(screenAudio.setEnabled).not.toHaveBeenCalled()
    expect(screenAudio.isDesired).toBe(true)
    subs.setPause(paused(false))
    subs.apply(people)
    expect(screen.setEnabled).toHaveBeenLastCalledWith(true)
    expect(camera.setEnabled).toHaveBeenLastCalledWith(true)
  })

  it('não mexe no vídeo que não está assinado (o SDK recusaria)', () => {
    const screen = publication('screen_share', 'video')
    const subs = new RemoteSubscriptions()
    subs.setPause(paused(true))
    subs.apply([participant('bia', [screen])])
    expect(screen.setEnabled).not.toHaveBeenCalled()
  })

  it('setPause diz se mudou (só então vale reaplicar)', () => {
    const subs = new RemoteSubscriptions()
    expect(subs.setPause(paused(false))).toBe(false)
    expect(subs.setPause(paused(true))).toBe(true)
    expect(subs.setPause(paused(true))).toBe(false)
    expect(subs.setPause(paused(true, ['bia']))).toBe(true)
    expect(subs.setPause(paused(true, ['bia']))).toBe(false)
    expect(subs.setPause(paused(true, ['caio']))).toBe(true)
  })

  it('live fora de vista: pausa só o vídeo dela; som e câmera seguem', () => {
    const screen = publication('screen_share', 'video')
    const screenAudio = publication('screen_share_audio', 'audio')
    const camera = publication('camera', 'video')
    const other = publication('screen_share', 'video')
    const people = [participant('bia', [screen, screenAudio, camera]), participant('caio', [other])]
    const subs = new RemoteSubscriptions()
    subs.setWatched(['bia', 'caio'])
    subs.setPause(paused(false, ['bia']))
    subs.apply(people)
    expect(screen.setEnabled).toHaveBeenLastCalledWith(false)
    expect(other.setEnabled).toHaveBeenLastCalledWith(true)
    expect(camera.setEnabled).toHaveBeenLastCalledWith(true)
    expect(screenAudio.setEnabled).not.toHaveBeenCalled()
    expect(screenAudio.isDesired).toBe(true)
    subs.setPause(paused(false))
    subs.apply(people)
    expect(screen.setEnabled).toHaveBeenLastCalledWith(true)
  })

  it('poda quem parou de transmitir', () => {
    const screen = publication('screen_share', 'video')
    const subs = new RemoteSubscriptions()
    subs.setWatched(['bia', 'caio'])
    subs.prune(['bia'])
    subs.apply([participant('caio', [screen])])
    expect(screen.setSubscribed).not.toHaveBeenCalled()
  })
})
