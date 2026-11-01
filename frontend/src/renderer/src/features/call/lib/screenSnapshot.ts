import { PREVIEW_JPEG_QUALITY, previewSize, stripDataUrl } from './screenPreview'

/** Quanto esperar o primeiro frame da tela antes de desistir da foto. */
const FRAME_TIMEOUT_MS = 3000

/**
 * Foto pequena (JPEG em base64) do vídeo da própria transmissão, para a
 * prévia no cartão de perfil. Usa um <video> solto, que não para a track.
 */
export async function captureScreenPreview(stream: MediaStream): Promise<string | null> {
  const [track] = stream.getVideoTracks()
  if (!track || track.readyState !== 'live') return null
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = new MediaStream([track])
  try {
    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no_frame')), FRAME_TIMEOUT_MS)
      video.addEventListener(
        'loadeddata',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true }
      )
    })
    await video.play().catch(() => {})
    await ready
    const size = previewSize(video.videoWidth, video.videoHeight)
    if (!size) return null
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, size.width, size.height)
    return stripDataUrl(canvas.toDataURL('image/jpeg', PREVIEW_JPEG_QUALITY))
  } catch {
    return null
  } finally {
    video.pause()
    video.srcObject = null
  }
}
