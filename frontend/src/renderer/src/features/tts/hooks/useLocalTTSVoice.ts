import { useEffect, useState } from 'react'
import type { TTSVoiceState } from '../../../../../shared/ttsVoice'

export interface LocalTTSVoice {
  /** null enquanto o main não respondeu. */
  state: TTSVoiceState | null
  /** Baixa a voz se ainda não está pronta. */
  prepare: () => void
}

/**
 * A voz do /tts baixada no primeiro uso (app desktop no Linux). null nas
 * outras plataformas, que usam as vozes do sistema.
 */
export function useLocalTTSVoice(): LocalTTSVoice | null {
  const api = window.api?.tts
  const [state, setState] = useState<TTSVoiceState | null>(null)
  useEffect(() => {
    if (!api) return
    let alive = true
    void api.voiceState().then((s) => alive && setState(s))
    const off = api.onVoiceState(setState)
    return () => {
      alive = false
      off()
    }
  }, [api])
  return api ? { state, prepare: api.prepare } : null
}
