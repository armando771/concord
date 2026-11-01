import { realtime } from '../../../shared/api/realtime'
import { LIVEKIT_URL } from '../../../shared/lib/config'
import { useAuthStore } from '../../auth/store/authStore'
import { useVoiceControlsStore } from '../../voice/store/voiceControlsStore'
import { endCallRequest, getCallToken, startCall } from '../api/calls'
import { createCallController } from './callController'
import { createLiveKitMedia } from './livekitMedia'
import { ensureMicPermission } from './micPermission'

/** A chamada do app, com a mídia, a API e o WebSocket reais. Um só objeto: telas e hooks falam com ele. */
export const callController = createCallController({
  api: { startCall, getCallToken, endCallRequest },
  media: createLiveKitMedia(),
  ws: {
    send: (type, payload) => realtime.sendEvent(type, payload),
    subscribe: (room) => realtime.subscribe(room),
    unsubscribe: (room) => realtime.unsubscribe(room)
  },
  liveKitUrl: LIVEKIT_URL,
  controls: () => {
    const { muted, deafened } = useVoiceControlsStore.getState()
    return { muted, deafened }
  },
  ensureMicPermission,
  meId: () => useAuthStore.getState().user?.id ?? null
})
