import { useEffect, useState } from 'react'

/**
 * Este aparelho tem voz para ler as mensagens /tts? null enquanto não se sabe
 * (as vozes do Chromium carregam depois). No Linux sem speech-dispatcher a
 * lista fica vazia.
 */
export function useTTSVoiceAvailable(): boolean | null {
  const synth = globalThis.speechSynthesis
  const [available, setAvailable] = useState<boolean | null>(() =>
    !synth ? false : synth.getVoices().length > 0 ? true : null
  )
  useEffect(() => {
    if (!synth) return
    const update = (): void => setAvailable(synth.getVoices().length > 0)
    synth.addEventListener('voiceschanged', update)
    // Sem o evento (nenhuma voz para carregar), decide depois de um instante.
    const timer = setTimeout(update, 1500)
    return () => {
      synth.removeEventListener('voiceschanged', update)
      clearTimeout(timer)
    }
  }, [synth])
  return available
}
