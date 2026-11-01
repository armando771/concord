import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useVoiceControlsStore } from '../../voice/store/voiceControlsStore'
import { callController } from '../lib/callRuntime'
import { useCallSessionStore } from '../store/callSessionStore'
import { useParticipantsStore } from '../store/participantsStore'

/**
 * Liga a chamada às coisas que mudam por fora dela: alguém atendeu (conecta a mídia), mudo/fone do painel ou
 * silêncio imposto por moderador (reaplica o áudio), movido de canal e sair da conta (desconecta).
 */
export function useCallLifecycle(): void {
  const signedOut = useAuthStore((s) => s.status === 'signedOut')
  const meId = useAuthStore((s) => s.user?.id)
  const phase = useCallSessionStore((s) => s.phase)
  const callId = useCallSessionStore((s) => s.callId)
  const movedTo = useCallSessionStore((s) => s.movedTo)
  const muted = useVoiceControlsStore((s) => s.muted)
  const deafened = useVoiceControlsStore((s) => s.deafened)
  const myVoice = useParticipantsStore((s) => (meId ? s.voice[meId] : undefined))

  useEffect(() => {
    if (phase === 'connecting' && callId) void callController.connectIfNeeded()
  }, [phase, callId])

  useEffect(() => {
    void callController.applyAudio()
  }, [muted, deafened, myVoice])

  useEffect(() => {
    if (movedTo) void callController.followMove()
  }, [movedTo])

  useEffect(() => {
    if (signedOut) void callController.leave(false)
  }, [signedOut])
}
