import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const config = vi.hoisted(() => ({ web: false }))
vi.mock('./config', () => ({
  get IS_WEB() {
    return config.web
  }
}))
vi.mock('./noiseSuppression', () => ({ openMicrophone: vi.fn() }))

import { getDisplayStream } from './rtc'
import { saveScreenQuality, streamQuality } from './screenShareQuality'
import { useScreenQualityStore } from '../store/screenQualityStore'
import { notePickerCancelled } from './screenPickerCancel'

const capture = vi.fn()
const ended = vi.fn()
function fakeStream(): {
  stream: MediaStream
  video: { applyConstraints: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }
  audio: { stop: ReturnType<typeof vi.fn> }
} {
  const video = {
    getSettings: () => ({ width: 3840, height: 2160 }),
    applyConstraints: vi.fn(async () => {}),
    stop: vi.fn(),
    addEventListener: vi.fn()
  }
  const audio = { stop: vi.fn() }
  return {
    video,
    audio,
    stream: {
      getVideoTracks: () => [video],
      getAudioTracks: () => [audio],
      getTracks: () => [video, audio]
    } as unknown as MediaStream
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  config.web = false
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: capture } })
  vi.stubGlobal('window', { api: { screenShare: { ended } } })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
  saveScreenQuality({ resolution: '1080p', frameRate: 30 })
})
afterEach(() => vi.unstubAllGlobals())

describe('captura de tela', () => {
  it('desktop: aplica a escolha feita no picker durante o pedido pendente', async () => {
    const { stream, video } = fakeStream()
    capture.mockImplementationOnce(async () => {
      saveScreenQuality({ resolution: '720p', frameRate: 60 })
      return stream
    })
    expect(await getDisplayStream()).toBe(stream)
    expect(video.applyConstraints).toHaveBeenCalledWith({
      width: { max: 1280 },
      height: { max: 720 },
      frameRate: { ideal: 60, max: 60 }
    })
    expect(streamQuality(stream)).toEqual({ resolution: '720p', frameRate: 60 })
  })

  it('web: só abre a captura nativa depois de confirmar a qualidade', async () => {
    config.web = true
    const { stream, video } = fakeStream()
    capture.mockResolvedValueOnce(stream)
    const pending = getDisplayStream()
    expect(capture).not.toHaveBeenCalled()
    useScreenQualityStore.getState().request!.resolve({ resolution: 'source', frameRate: 60 })
    expect(await pending).toBe(stream)
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ video: { frameRate: 60 } }))
    expect(video.applyConstraints).toHaveBeenCalledWith({ frameRate: { ideal: 60, max: 60 } })
  })

  it('cancelar a qualidade na web não abre a captura', async () => {
    config.web = true
    const pending = getDisplayStream()
    useScreenQualityStore.getState().request!.resolve(null)
    await expect(pending).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(capture).not.toHaveBeenCalled()
  })

  it('fallback sem áudio mantém a qualidade escolhida', async () => {
    config.web = true
    const { stream } = fakeStream()
    capture.mockRejectedValueOnce(new TypeError('áudio indisponível')).mockResolvedValueOnce(stream)
    const pending = getDisplayStream()
    useScreenQualityStore.getState().request!.resolve({ resolution: '1080p', frameRate: 60 })
    await pending
    expect(capture).toHaveBeenLastCalledWith({ video: { frameRate: 60 }, audio: false })
    expect(streamQuality(stream).frameRate).toBe(60)
  })

  it('libera vídeo, áudio e helper nativo se aplicar a qualidade falhar', async () => {
    const { stream, video, audio } = fakeStream()
    video.applyConstraints.mockRejectedValueOnce(new Error('falhou'))
    capture.mockResolvedValueOnce(stream)
    await expect(getDisplayStream()).rejects.toThrow('falhou')
    expect(video.stop).toHaveBeenCalledOnce()
    expect(audio.stop).toHaveBeenCalledOnce()
    expect(ended).toHaveBeenCalledOnce()
  })

  it('cancelar no desktop continua sendo NotAllowedError', async () => {
    capture.mockImplementationOnce(async () => {
      notePickerCancelled()
      throw new DOMException('cancelado', 'AbortError')
    })
    await expect(getDisplayStream()).rejects.toMatchObject({ name: 'NotAllowedError' })
  })
})
