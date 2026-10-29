import { onWsEvent } from '../../../shared/api/ws'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../../call/store/callStore'
import { useVoiceAudioStore } from '../../call/store/voiceAudioStore'
import type { Message } from '../../chat/api/messages'
import { useServerStore } from '../../servers/store/serverStore'
import { useTTSSettingsStore } from '../store/ttsSettingsStore'
import { createWebSpeechSpeaker } from './ttsEngine'
import { createTTSListener, type TTSListenerContext } from './ttsListener'
import { createTTSQueue } from './ttsQueue'
import { chooseTTSSpeaker } from './ttsSpeaker'
import { ttsNames } from './ttsNames'
import { playWav } from './wavPlayer'
import type { SpokenNames } from './ttsText'

function liveContext(): TTSListenerContext {
  const call = useCallStore.getState()
  const meId = useAuthStore.getState().user?.id
  return {
    enabled: useTTSSettingsStore.getState().enabled,
    call: {
      status: call.status,
      type: call.type,
      serverId: call.serverId,
      channelId: call.channelId,
      conversationId: call.conversationId
    },
    deafened: call.deafened,
    serverDeafened: Boolean(meId && call.voiceStates[meId]?.serverDeafened),
    callId: call.callId
  }
}

function liveNames(msg: Message, serverId: string | null): SpokenNames {
  const servers = useServerStore.getState()
  return ttsNames(msg.author_id, serverId, {
    participants: useCallStore.getState().participants,
    nicknames: servers.nicknames,
    currentServerId: servers.currentServer?.id,
    currentMembers: servers.currentMembers
  })
}

/**
 * Liga a leitura em voz das mensagens /tts (docs/adr/0012-tts-no-cliente.md).
 * Chamado uma vez na entrada do app; devolve o "desligar".
 */
export function startTTS(): () => void {
  const speaker = chooseTTSSpeaker({
    local: window.api?.tts,
    webSpeech: () =>
      createWebSpeechSpeaker({
        synth: globalThis.speechSynthesis,
        Utterance: globalThis.SpeechSynthesisUtterance,
        volume: () => useVoiceAudioStore.getState().outputVolume
      }),
    play: playWav
  })
  if (!speaker) return () => {}
  const listener = createTTSListener({
    context: liveContext,
    names: liveNames,
    queue: createTTSQueue(speaker)
  })
  const offs = [
    onWsEvent(listener.onEvent),
    useCallStore.subscribe(listener.onStateChange),
    useTTSSettingsStore.subscribe(listener.onStateChange)
  ]
  return () => offs.forEach((off) => off())
}
