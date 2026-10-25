import { useMemo } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useServerStore } from '../../store/serverStore'
import { mergeCallPeople } from '../../lib/callParticipants'
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
 * Palco da chamada estilo Discord: sem vídeo = grid de avatares; com telas
 * ou câmeras, mosaico redimensionável e reorganizável e, ao clicar numa
 * tela, foco grande + demais em mini-grid.
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
  const backendParticipants = useCallStore((s) => s.participants)
  const mediaPeers = useCallStore((s) => s.mediaPeers)
  const members = useServerStore((s) => s.currentMembers)
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
  // Lista do backend + quem está na sala de mídia (o backend pode ter perdido alguém).
  const participants = useMemo(
    () =>
      mergeCallPeople(backendParticipants, mediaPeers, meId, (id) => {
        const m = members.find((x) => x.user_id === id)
        return m?.display_name || m?.username
      }),
    [backendParticipants, mediaPeers, meId, members]
  )
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
  const cameras: ScreenEntry[] = [
    ...(localCameraStream ? [{ userId: meId, stream: localCameraStream }] : []),
    ...participants
      .filter((p) => videoStreams[p.id])
      .map((p) => ({ userId: p.id, stream: videoStreams[p.id] as MediaStream }))
  ]

  // Voz pura: ninguém com tela nem câmera — grid de avatares.
  if (screens.length === 0 && cameras.length === 0) {
    return (
      <div className={`flex flex-wrap items-center justify-center ${gap}`}>
        <ParticipantTile
          user={meInfo}
          selfMuted={muted}
          deafened={deafened}
          speaking={meSpeaking}
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
          />
        ))}
      </div>
    )
  }

  const focused = screens.find((entry) => entry.userId === focusedId) ?? null

  // Sem foco selecionado: mosaico com as telas e as câmeras (cada uma é um
  // bloco: "screen:<id>" / "camera:<id>") + quem não tem vídeo embaixo.
  if (!focused) {
    const tiles = new Map<string, { kind: 'screen' | 'camera'; entry: ScreenEntry }>([
      ...screens.map(
        (entry) => [`screen:${entry.userId}`, { kind: 'screen' as const, entry }] as const
      ),
      ...cameras.map(
        (entry) => [`camera:${entry.userId}`, { kind: 'camera' as const, entry }] as const
      )
    ])
    const inMosaic = new Set([...screens, ...cameras].map((entry) => entry.userId))
    const renderTile = (key: string): React.JSX.Element | null => {
      const tile = tiles.get(key)
      if (!tile) return null
      const { userId, stream } = tile.entry
      if (tile.kind === 'screen') {
        return (
          <ParticipantTile
            user={nameOf(userId)}
            videoStream={stream}
            isScreen
            size="fill"
            onClick={() => setFocused(userId)}
            onContextMenu={streamMenuHandler(userId, nameOf(userId).display_name, meId)}
            locallyMuted={localAudio[streamAudioKey(userId)]?.muted ?? false}
          />
        )
      }
      if (userId === meId) {
        return (
          <ParticipantTile
            user={meInfo}
            selfMuted={muted}
            deafened={deafened}
            speaking={meSpeaking}
            videoStream={stream}
            size="fill"
            mirror
          />
        )
      }
      const p = nameOf(userId)
      return (
        <ParticipantTile
          user={p}
          selfMuted={voiceStates[userId]?.muted}
          onContextMenu={userMenuHandler(userId, p.display_name, meId, p.username)}
          locallyMuted={localAudio[userId]?.muted ?? false}
          deafened={voiceStates[userId]?.deafened}
          speaking={speaking?.has(userId) ?? false}
          videoStream={stream}
          size="fill"
        />
      )
    }

    return (
      <div className="flex h-full w-full flex-col gap-4">
        <StreamMosaic
          ids={[...tiles.keys()]}
          nameOf={(key) => {
            const tile = tiles.get(key)
            if (!tile) return ''
            const name = nameOf(tile.entry.userId).display_name
            return tile.kind === 'screen' ? `${name} (tela)` : `${name} (câmera)`
          }}
          renderTile={renderTile}
        />
        {(!inMosaic.has(meId) || participants.some((p) => !inMosaic.has(p.id))) && (
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
            {!inMosaic.has(meId) && (
              <ParticipantTile
                user={meInfo}
                selfMuted={muted}
                deafened={deafened}
                speaking={meSpeaking}
                size="md"
              />
            )}
            {participants
              .filter((p) => !inMosaic.has(p.id))
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
                />
              ))}
          </div>
        )}
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
