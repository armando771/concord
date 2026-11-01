import { useAuthStore } from '../../auth/store/authStore'
import { useChatStore } from '../../chat/store/chatStore'
import { useCallStore } from '../store/callStore'
import { createSpeechReporter, SPEECH_REPORT_EVERY_MS, type SpeechView } from './speechReport'

function viewNow(): SpeechView {
  const s = useCallStore.getState()
  return {
    callId: s.callId,
    status: s.status,
    meId: useAuthStore.getState().user?.id ?? null,
    muted: s.muted,
    speakingIds: s.speakingIds
  }
}

/**
 * Avisa o servidor (call:speaking) enquanto eu falo na call: quando começo a
 * falar e, falando sem pausa, a cada 15 s. Chamado uma vez na entrada do app;
 * devolve o "desligar".
 */
export function startSpeechReport(): () => void {
  const reporter = createSpeechReporter({
    send: (callId) => useChatStore.getState().sendEvent('call:speaking', { call_id: callId }),
    now: Date.now
  })
  const offState = useCallStore.subscribe((next, prev) => {
    if (next.speakingIds !== prev.speakingIds) reporter.observe(viewNow())
  })
  const timer = setInterval(() => reporter.observe(viewNow()), SPEECH_REPORT_EVERY_MS)
  return () => {
    offState()
    clearInterval(timer)
  }
}
