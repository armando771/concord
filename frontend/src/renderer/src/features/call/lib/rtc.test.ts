import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const config = vi.hoisted(() => ({ web: false }))
vi.mock('../../../shared/lib/config', () => ({
  get IS_WEB() {
    return config.web
  }
}))
vi.mock('./noiseSuppression', () => ({ openMicrophone: vi.fn() }))

import { getCameraStream, getDisplayStream } from './rtc'
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
    // 60 fps = jogo: dica de movimento (com 'detail' um jogo pesado caía para 4–8 fps).
    expect((video as { contentHint?: string }).contentHint).toBe('motion')
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

  describe('Linux/Wayland (portal)', () => {
    const portalStatus = vi.fn()
    beforeEach(() => {
      portalStatus.mockResolvedValue({ status: 'available', message: '' })
      vi.stubGlobal('window', { api: { screenShare: { ended, flow: 'portal', portalStatus } } })
    })

    it('escolhe a qualidade no app e só então abre o seletor do sistema, sem som', async () => {
      const { stream, video } = fakeStream()
      capture.mockResolvedValueOnce(stream)
      const pending = getDisplayStream()
      await vi.waitFor(() => expect(useScreenQualityStore.getState().request).not.toBeNull())
      expect(capture).not.toHaveBeenCalled()
      useScreenQualityStore.getState().request!.resolve({ resolution: '720p', frameRate: 60 })
      expect(await pending).toBe(stream)
      expect(capture).toHaveBeenCalledWith(
        expect.objectContaining({ video: { frameRate: 60 }, audio: false })
      )
      expect(video.applyConstraints).toHaveBeenCalledWith({
        width: { max: 1280 },
        height: { max: 720 },
        frameRate: { ideal: 60, max: 60 }
      })
    })

    it('sem o portal: erro que diz o que instalar, sem abrir nada', async () => {
      portalStatus.mockResolvedValueOnce({ status: 'missing', message: 'Instale o portal' })
      await expect(getDisplayStream()).rejects.toMatchObject({
        name: 'ScreenShareSetupError',
        message: 'Instale o portal'
      })
      expect(useScreenQualityStore.getState().request).toBeNull()
      expect(capture).not.toHaveBeenCalled()
    })

    it('não deu para saber se há portal: tenta assim mesmo', async () => {
      portalStatus.mockResolvedValueOnce({ status: 'unknown', message: '' })
      const { stream } = fakeStream()
      capture.mockResolvedValueOnce(stream)
      const pending = getDisplayStream()
      await vi.waitFor(() => expect(useScreenQualityStore.getState().request).not.toBeNull())
      useScreenQualityStore.getState().request!.resolve({ resolution: '1080p', frameRate: 30 })
      expect(await pending).toBe(stream)
    })

    it('fechar o seletor do sistema é cancelamento (sem aviso de erro)', async () => {
      capture.mockRejectedValueOnce(new DOMException('Invalid capture constraints', 'AbortError'))
      const pending = getDisplayStream()
      await vi.waitFor(() => expect(useScreenQualityStore.getState().request).not.toBeNull())
      useScreenQualityStore.getState().request!.resolve({ resolution: '1080p', frameRate: 30 })
      await expect(pending).rejects.toMatchObject({ name: 'NotAllowedError' })
    })
  })
})

describe('câmera', () => {
  const getUserMedia = vi.fn()
  const camStream = (): MediaStream => {
    const track = { contentHint: '' }
    return { getVideoTracks: () => [track] } as unknown as MediaStream
  }
  beforeEach(() => {
    getUserMedia.mockReset()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  })

  it('sem dispositivo escolhido usa a câmera padrão', async () => {
    const stream = camStream()
    getUserMedia.mockResolvedValue(stream)
    expect(await getCameraStream()).toBe(stream)
    const { video, audio } = getUserMedia.mock.calls[0][0]
    expect(audio).toBe(false)
    expect(video.deviceId).toBeUndefined()
    expect(stream.getVideoTracks()[0].contentHint).toBe('motion')
  })

  it('com dispositivo escolhido pede exatamente ele', async () => {
    getUserMedia.mockResolvedValue(camStream())
    await getCameraStream('cam-2')
    expect(getUserMedia.mock.calls[0][0].video.deviceId).toEqual({ exact: 'cam-2' })
  })

  it('câmera escolhida que sumiu: abre a padrão', async () => {
    const stream = camStream()
    getUserMedia
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'OverconstrainedError' }))
      .mockResolvedValueOnce(stream)
    expect(await getCameraStream('cam-sumiu')).toBe(stream)
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    expect(getUserMedia.mock.calls[1][0].video.deviceId).toBeUndefined()
  })

  it('permissão negada não tenta de novo', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    await expect(getCameraStream('cam-2')).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('sem dispositivo escolhido, o erro sobe direto', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('x'), { name: 'OverconstrainedError' }))
    await expect(getCameraStream()).rejects.toBeTruthy()
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })
})
