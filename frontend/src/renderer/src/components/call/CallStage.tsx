import { useAuthStore } from '../../store/authStore'
import { streamAudioKey, useUserAudioStore } from '../../store/userAudioStore'
import { streamMenuHandler, userMenuHandler } from '../../store/userMenuStore'
import { useCallStore } from '../../store/callStore'
import type { CallUserInfo } from '../../store/callStore'
import { ChevronDownIcon } from '../icons'
import ParticipantTile from './ParticipantTile'
import StreamMosaic from './StreamMosaic'

interface ScreenEntry {
  userId: string
  stream: MediaStream
}

/**
 * Palco da chamada estilo Discord: sem tela = grid de avatares; com telas,
 * mosaico das transmissões (redimensionável e reorganizável) e, ao clicar
 * numa tela, foco grande + demais em mini-grid.
 * Compartilhado entre VoiceChannelView e DmCallView.
 */
function CallStage({
  gap = 'gap-6',
  speaking
}: {
  gap?: string
  /** ids dos usuários falando agora (useSpeaking) */
  speaking?: Set<string>
}): React.JSX.Element {
  const me = useAuthStore((s) => s.user)
  const participants = useCallStore((s) => s.participants)
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
  const voiceStates = useCallStore((s) => s.voiceStates)
  const localAudio = useUserAudioStore((s) => s.settings)
  const localScreenStream = useCallStore((s) => s.localScreenStream)
  const screenStreams = useCallStore((s) => s.screenStreams)
  const focusedId = useCallStore((s) => s.focusedScreenUserId)
  const setFocused = useCallStore((s) => s.setFocusedScreenUser)
  const localCameraStream = useCallStore((s) => s.localCameraStream)
  const videoStreams = useCallStore((s) => s.videoStreams)

  const meId = me?.id ?? 'me'
  const meSpeaking = !muted && (speaking?.has(meId) ?? false)
  const meInfo: CallUserInfo = {
    id: meId,
    username: me?.username ?? '',
    display_name: me?.display_name ?? 'Você'
  }

  const nameOf = (userId: string): CallUserInfo =>
    userId === meId
      ? meInfo
      : (participants.find((p) => p.id === userId) ?? {
          id: userId,
          username: '',
          display_name: 'Usuário'
        })

  const screens: ScreenEntry[] = [
    ...(localScreenStream ? [{ userId: meId, stream: localScreenStream }] : []),
    ...Object.entries(screenStreams).map(([userId, stream]) => ({ userId, stream }))
  ]
  const hasScreens = screens.length > 0

  // Sem ninguém compartilhando: grid de avatares/vídeos de câmera (eu + participantes).
  if (!hasScreens) {
    return (
      <div className={`flex flex-wrap items-center justify-center ${gap}`}>
        <ParticipantTile
          user={meInfo}
          selfMuted={muted}
          deafened={deafened}
          speaking={meSpeaking}
          videoStream={localCameraStream}
          mirror
        />
        {participants.map((p) => (
          <ParticipantTile
            key={p.id}
            user={p}
            selfMuted={voiceStates[p.id]?.muted}
            onContextMenu={userMenuHandler(p.id, p.display_name, meId, p.username)}
            locallyMuted={localAudio[p.id]?.muted ?? false}
            deafened={voiceStates[p.id]?.deafened}
            speaking={speaking?.has(p.id) ?? false}
            videoStream={videoStreams[p.id] ?? null}
          />
        ))}
      </div>
    )
  }

  const focused = screens.find((entry) => entry.userId === focusedId) ?? null

  // Sem foco selecionado: mosaico das transmissões + quem não transmite embaixo.
  if (!focused) {
    const streamOf = new Map(screens.map((entry) => [entry.userId, entry.stream]))
    return (
      <div className="flex h-full w-full flex-col gap-4">
        <StreamMosaic
          ids={screens.map((entry) => entry.userId)}
          nameOf={(userId) => nameOf(userId).display_name}
          renderTile={(userId) => (
            <ParticipantTile
              user={nameOf(userId)}
              videoStream={streamOf.get(userId) ?? null}
              isScreen
              size="fill"
              onClick={() => setFocused(userId)}
              onContextMenu={streamMenuHandler(userId, nameOf(userId).display_name, meId)}
              locallyMuted={localAudio[streamAudioKey(userId)]?.muted ?? false}
            />
          )}
        />
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
          <ParticipantTile
            user={meInfo}
            selfMuted={muted}
            deafened={deafened}
            speaking={meSpeaking}
            size="md"
            videoStream={localCameraStream}
            mirror
          />
          {participants
            .filter((p) => !screenStreams[p.id])
            .map((p) => (
              <ParticipantTile
                key={p.id}
                user={p}
                selfMuted={voiceStates[p.id]?.muted}
                onContextMenu={userMenuHandler(p.id, p.display_name, meId, p.username)}
                locallyMuted={localAudio[p.id]?.muted ?? false}
                deafened={voiceStates[p.id]?.deafened}
                size="md"
                speaking={speaking?.has(p.id) ?? false}
                videoStream={videoStreams[p.id] ?? null}
              />
            ))}
        </div>
      </div>
    )
  }

  // Foco grande (estilo Go Live) + strip com os demais.
  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="relative flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-1">
          <button
            onClick={() => setFocused(null)}
            aria-label="Sair do modo foco"
            title="Sair da tela cheia"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-gray-200 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        </div>
        <ParticipantTile
          user={nameOf(focused.userId)}
          videoStream={focused.stream}
          isScreen
          size="fill"
          onContextMenu={streamMenuHandler(
            focused.userId,
            nameOf(focused.userId).display_name,
            meId
          )}
          locallyMuted={localAudio[streamAudioKey(focused.userId)]?.muted ?? false}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
        {screens
          .filter((entry) => entry.userId !== focused.userId)
          .map((entry) => (
            <ParticipantTile
              key={entry.userId}
              user={nameOf(entry.userId)}
              videoStream={entry.stream}
              isScreen
              size="md"
              onClick={() => setFocused(entry.userId)}
              onContextMenu={streamMenuHandler(
                entry.userId,
                nameOf(entry.userId).display_name,
                meId
              )}
              locallyMuted={localAudio[streamAudioKey(entry.userId)]?.muted ?? false}
            />
          ))}
        <ParticipantTile
          user={meInfo}
          selfMuted={muted}
          deafened={deafened}
          speaking={meSpeaking}
          size="md"
          videoStream={localCameraStream}
          mirror
        />
        {participants
          .filter((p) => p.id !== focused.userId && !screenStreams[p.id])
          .map((p) => (
            <ParticipantTile
              key={p.id}
              user={p}
              selfMuted={voiceStates[p.id]?.muted}
              onContextMenu={userMenuHandler(p.id, p.display_name, meId, p.username)}
              locallyMuted={localAudio[p.id]?.muted ?? false}
              deafened={voiceStates[p.id]?.deafened}
              size="md"
              speaking={speaking?.has(p.id) ?? false}
              videoStream={videoStreams[p.id] ?? null}
            />
          ))}
      </div>
    </div>
  )
}

export default CallStage
