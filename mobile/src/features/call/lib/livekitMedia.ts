import { AudioSession } from '@livekit/react-native'
import { ConnectionState, Room, RoomEvent } from 'livekit-client'
import type { CallMedia, MediaConnection } from './callMedia'

// Único arquivo do app que fala com o SDK do LiveKit (ADR 0023). Fica fora da cobertura do Jest (módulo nativo):
// a lógica toda está no callController, testado com uma CallMedia falsa. Provado no aparelho (PR B).

/** Volume 0 silencia quem chega sem sair da sala: é o "fone" do painel do usuário. */
const setRemoteVolume = (room: Room, listening: boolean): void => {
  room.remoteParticipants.forEach((p) => p.setVolume(listening ? 1 : 0))
}

export function createLiveKitMedia(): CallMedia {
  let room: Room | null = null
  let listening = true
  const speakerListeners = new Set<(ids: string[]) => void>()
  const connectionListeners = new Set<(state: MediaConnection) => void>()

  const emitConnection = (state: MediaConnection): void => connectionListeners.forEach((l) => l(state))

  function watch(next: Room): void {
    next.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const ids = speakers.map((s) => s.identity)
      speakerListeners.forEach((l) => l(ids))
    })
    next.on(RoomEvent.Reconnecting, () => emitConnection('reconnecting'))
    next.on(RoomEvent.Reconnected, () => emitConnection('connected'))
    next.on(RoomEvent.Disconnected, () => emitConnection('disconnected'))
    next.on(RoomEvent.ParticipantConnected, () => setRemoteVolume(next, listening))
  }

  return {
    async connect(url, token) {
      await AudioSession.startAudioSession()
      const next = new Room()
      watch(next)
      room = next
      await next.connect(url, token)
      setRemoteVolume(next, listening)
    },
    async disconnect() {
      const current = room
      room = null
      if (current && current.state !== ConnectionState.Disconnected) await current.disconnect()
      await AudioSession.stopAudioSession()
    },
    async setMicEnabled(on) {
      await room?.localParticipant.setMicrophoneEnabled(on)
    },
    setListening(on) {
      listening = on
      if (room) setRemoteVolume(room, on)
    },
    onSpeakers(listener) {
      speakerListeners.add(listener)
      return () => speakerListeners.delete(listener)
    },
    onConnection(listener) {
      connectionListeners.add(listener)
      return () => connectionListeners.delete(listener)
    }
  }
}
