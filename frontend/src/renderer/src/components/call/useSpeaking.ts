import { useMemo } from 'react'
import { useCallStore } from '../../store/callStore'

// Quem está falando agora, segundo o LiveKit (inclui o próprio usuário).
function useSpeaking(): Set<string> {
  const speakingIds = useCallStore((s) => s.speakingIds)
  return useMemo(() => new Set(speakingIds), [speakingIds])
}

export default useSpeaking
