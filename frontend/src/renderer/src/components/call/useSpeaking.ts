import { useMemo } from 'react'
import { useCallStore } from '../../store/callStore'

// Quem está falando agora: os outros segundo o LiveKit, o próprio usuário pela
// detecção local do microfone (ver callStore.publishSpeaking).
function useSpeaking(): Set<string> {
  const speakingIds = useCallStore((s) => s.speakingIds)
  return useMemo(() => new Set(speakingIds), [speakingIds])
}

export default useSpeaking
