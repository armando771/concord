import { describe, expect, it, vi } from 'vitest'
import { useWindowActivityStore } from '../../../shared/store/windowActivityStore'
import { RemoteSubscriptions, watchHiddenWindow, type RemoteParticipantLike } from './remoteSubscriptions'

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

function participant(identity: string, pubs: ReturnType<typeof publication>[]): RemoteParticipantLike {
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
    subs.setVideoPaused(true)
    subs.apply(people)
    expect(screen.setEnabled).toHaveBeenLastCalledWith(false)
    expect(camera.setEnabled).toHaveBeenLastCalledWith(false)
    expect(screenAudio.setEnabled).not.toHaveBeenCalled()
    expect(screenAudio.isDesired).toBe(true)
    subs.setVideoPaused(false)
    subs.apply(people)
    expect(screen.setEnabled).toHaveBeenLastCalledWith(true)
    expect(camera.setEnabled).toHaveBeenLastCalledWith(true)
  })

  it('não mexe no vídeo que não está assinado (o SDK recusaria)', () => {
    const screen = publication('screen_share', 'video')
    const subs = new RemoteSubscriptions()
    subs.setVideoPaused(true)
    subs.apply([participant('bia', [screen])])
    expect(screen.setEnabled).not.toHaveBeenCalled()
  })

  it('setVideoPaused diz se mudou (só então vale reaplicar)', () => {
    const subs = new RemoteSubscriptions()
    expect(subs.setVideoPaused(false)).toBe(false)
    expect(subs.setVideoPaused(true)).toBe(true)
    expect(subs.setVideoPaused(true)).toBe(false)
  })

  it('watchHiddenWindow: avisa já e só quando a janela some ou volta (foco não conta)', () => {
    const store = useWindowActivityStore.getState()
    store.setActivity({ focused: true, visible: true })
    const onChange = vi.fn()
    const stop = watchHiddenWindow(onChange)
    store.setActivity({ focused: false, visible: true })
    store.setActivity({ focused: false, visible: false })
    store.setActivity({ focused: true, visible: true })
    stop()
    store.setActivity({ focused: false, visible: false })
    expect(onChange.mock.calls).toEqual([[false], [true], [false]])
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
