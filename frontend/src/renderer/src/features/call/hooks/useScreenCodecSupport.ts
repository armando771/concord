import { useEffect, useState } from 'react'
import { detectScreenCodecs, type ScreenCodecSupport } from '../lib/screenCodecSupport'

/** Tamanho de referência para mostrar em Avançado o que a placa codifica (1080p 60). */
const REFERENCE = { width: 1920, height: 1080, bitrate: 7_000_000, framerate: 60 }

/** O que a placa de vídeo codifica; null enquanto o Chromium não respondeu. */
export function useScreenCodecSupport(): ScreenCodecSupport | null {
  const [support, setSupport] = useState<ScreenCodecSupport | null>(null)
  useEffect(() => {
    let alive = true
    void detectScreenCodecs(REFERENCE).then((result) => {
      if (alive) setSupport(result)
    })
    return () => {
      alive = false
    }
  }, [])
  return support
}
