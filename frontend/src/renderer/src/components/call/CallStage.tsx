import { useEffect, useMemo } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useServerStore } from '../../store/serverStore'
import { mergeCallPeople } from '../../lib/callParticipants'
import { serverDisplayName, withServerNames } from '../../lib/serverNames'
import { useCallNicknames } from '../../store/useServerNames'
import { sortVoiceMembers } from '../../lib/voiceOrder'
import { useLevelStore } from '../../store/levelStore'
import { streamAudioKey, useUserAudioStore } from '../../store/userAudioStore'
import { streamMenuHandler, userMenuHandler } from '../../store/userMenuStore'
import { useCallStore } from '../../store/callStore'
import type { CallUserInfo } from '../../store/callStore'
import { buildScreenEntries, type ScreenEntry } from '../../lib/screenWatch'
import { ChevronDownIcon, XIcon } from '../icons'
import Button from '../Button'
import ParticipantTile from './ParticipantTile'
import StreamMosaic from './StreamMosaic'

/**
 * Palco da chamada estilo Discord: sem vídeo = grid de avatares; com telas
 * ou câmeras, mosaico redimensionável e reorganizável e, ao clicar numa
 * tela, foco grande + demais em mini-grid. Tela dos outros começa pausada
 * (card "Assistir transmissão") e só é baixada depois do clique.
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
  const availableScreens = useCallStore((s) => s.availableScreens)
  const watchedScreenIds = useCallStore((s) => s.watchedScreenIds)
  const watchScreen = useCallStore((s) => s.watchScreen)
  const stopWatchingScreen = useCallStore((s) => s.stopWatchingScreen)
  const setStageVisible = useCallStore((s) => s.setStageVisible)

  // Montado = tela da call visível (canal conectado ou DM expandida); fora
  // dela a transmissão assistida vira miniatura (ScreenMiniPlayer).
  useEffect(() => {
    setStageVisible(true)
    return () => setStageVisible(false)
  }, [setStageVisible])
  const focusedId = useCallStore((s) => s.focusedScreenUserId)
  const setFocused = useCallStore((s) => s.setFocusedScreenUser)
  const localCameraStream = useCallStore((s) => s.localCameraStream)
  const videoStreams = useCallStore((s) => s.videoStreams)
  const levels = useLevelStore((s) => s.levels)
  const ensureLevels = useLevelStore((s) => s.ensureLevels)
  // joined_at só vem na lista do servidor (canal de voz); na DM fica sem.
  const channelEntry = useCallStore((s) => (s.channelId ? s.serverCalls[s.channelId] : undefined))

  const meId = me?.id ?? 'me'
  // Call num canal de voz: cada um com o apelido daquele servidor.
  const nicknames = useCallNicknames()
  // Lista do backend + quem está na sala de mídia (o backend pode ter perdido alguém).
  const participants = useMemo(
    () =>
      withServerNames(
        mergeCallPeople(backendParticipants, mediaPeers, meId, (id) => {
          const m = members.find((x) => x.user_id === id)
          return m?.display_name || m?.username
        }),
        nicknames
      ),
    [backendParticipants, mediaPeers, meId, members, nicknames]
  )
  // Mesma ordem da lista do canal na barra lateral (nível, entrada, nome). O
  // mosaico de vídeo tem a ordem que a pessoa arrumou e não passa por aqui.
  const peopleIdsKey = participants.map((p) => p.id).join(',')
  useEffect(() => {
    if (peopleIdsKey) ensureLevels(peopleIdsKey.split(','))
  }, [peopleIdsKey, ensureLevels])
  const people = useMemo(() => {
    const joinedAt = new Map(channelEntry?.participants.map((p) => [p.user_id, p.joined_at]))
    return sortVoiceMembers(participants, (p) => ({
      id: p.id,
      name: p.display_name,
      level: levels[p.id],
      joinedAt: joinedAt.get(p.id)
    }))
  }, [participants, levels, channelEntry])
  const meSpeaking = !muted && (speaking?.has(meId) ?? false)
  const meInfo: CallUserInfo = {
    id: meId,
    username: me?.username ?? '',
    display_name: serverDisplayName({ nickname: nicknames?.[meId] }, me, 'Você')
  }

  const nameOf = (userId: string): CallUserInfo =>
    userId === meId
      ? meInfo
      : (participants.find((p) => p.id === userId) ?? {
          id: userId,
          username: '',
          display_name: 'Usuário'
        })

  const screens = buildScreenEntries({
    meId,
    localScreenStream,
    availableScreens,
    watchedScreenIds,
    screenStreams
  })
  const cameras: Array<{ userId: string; stream: MediaStream }> = [
    ...(localCameraStream ? [{ userId: meId, stream: localCameraStream }] : []),
    ...participants
      .filter((p) => videoStreams[p.id])
      .map((p) => ({ userId: p.id, stream: videoStreams[p.id] as MediaStream }))
  ]

  /** Tile de uma tela: a minha, uma assistida (clicável + fechar) ou o card parado. */
  const screenTile = (entry: ScreenEntry, size: 'md' | 'fill'): React.JSX.Element => {
    const common = {
      user: nameOf(entry.userId),
      isScreen: true,
      size,
      onContextMenu: streamMenuHandler(entry.userId, nameOf(entry.userId).display_name, meId),
      locallyMuted: localAudio[streamAudioKey(entry.userId)]?.muted ?? false
    }
    if (!entry.watching) {
      return (
        <ParticipantTile
          key={entry.userId}
          {...common}
          videoStream={null}
          action={
            <Button
              variant="success"
              onClick={() => watchScreen(entry.userId)}
              className={size === 'md' ? 'px-2.5 py-1 text-xs' : ''}
            >
              Assistir transmissão
            </Button>
          }
        />
      )
    }
    return (
      <ParticipantTile
        key={entry.userId}
        {...common}
        videoStream={entry.stream}
        onClick={() => setFocused(entry.userId)}
        onClose={entry.local ? undefined : () => stopWatchingScreen(entry.userId)}
        streamAudioUserId={entry.local ? undefined : entry.userId}
        fullscreenable={!entry.local}
      />
    )
  }

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
        {people.map((p) => (
          <ParticipantTile
            key={p.id}
            user={p}
            selfMuted={voiceStates[p.id]?.muted}
            onContextMenu={userMenuHandler(p.id, p.display_name, meId, p.username)}
            locallyMuted={localAudio[p.id]?.muted ?? false}
            deafened={voiceStates[p.id]?.deafened}
            serverMuted={voiceStates[p.id]?.serverMuted}
            serverDeafened={voiceStates[p.id]?.serverDeafened}
            speaking={speaking?.has(p.id) ?? false}
          />
        ))}
      </div>
    )
  }

  const focused = screens.find((entry) => entry.userId === focusedId && entry.watching) ?? null

  // Sem foco selecionado: mosaico com as telas e as câmeras (cada uma é um
  // bloco: "screen:<id>" / "camera:<id>") + quem não tem vídeo embaixo.
  if (!focused) {
    const tiles = new Map<
      string,
      | { kind: 'screen'; entry: ScreenEntry }
      | { kind: 'camera'; entry: { userId: string; stream: MediaStream } }
    >([
      ...screens.map(
        (entry) => [`screen:${entry.userId}`, { kind: 'screen' as const, entry }] as const
      ),
      ...cameras.map(
        (entry) => [`camera:${entry.userId}`, { kind: 'camera' as const, entry }] as const
      )
    ])
    // Quem transmite (assistido ou não) e quem tem câmera aparece no mosaico.
    const inMosaic = new Set([...screens, ...cameras].map((entry) => entry.userId))
    const renderTile = (key: string): React.JSX.Element | null => {
      const tile = tiles.get(key)
      if (!tile) return null
      if (tile.kind === 'screen') return screenTile(tile.entry, 'fill')
      const { userId, stream } = tile.entry
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
          serverMuted={voiceStates[userId]?.serverMuted}
          serverDeafened={voiceStates[userId]?.serverDeafened}
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
        {(!inMosaic.has(meId) || people.some((p) => !inMosaic.has(p.id))) && (
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
            {people
              .filter((p) => !inMosaic.has(p.id))
              .map((p) => (
                <ParticipantTile
                  key={p.id}
                  user={p}
                  selfMuted={voiceStates[p.id]?.muted}
                  onContextMenu={userMenuHandler(p.id, p.display_name, meId, p.username)}
                  locallyMuted={localAudio[p.id]?.muted ?? false}
                  deafened={voiceStates[p.id]?.deafened}
                  serverMuted={voiceStates[p.id]?.serverMuted}
                  serverDeafened={voiceStates[p.id]?.serverDeafened}
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
        <div className="absolute inset-x-0 top-0 z-10 flex items-start gap-2 px-1">
          <button
            onClick={() => setFocused(null)}
            aria-label="Sair do modo foco"
            title="Sair do modo foco"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-gray-200 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </button>
          {!focused.local && (
            <button
              onClick={() => stopWatchingScreen(focused.userId)}
              aria-label="Fechar transmissão"
              title="Fechar transmissão"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-gray-200 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
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
          streamAudioUserId={focused.local ? undefined : focused.userId}
          fullscreenable={!focused.local}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
        {screens
          .filter((entry) => entry.userId !== focused.userId)
          .map((entry) => screenTile(entry, 'md'))}
        <ParticipantTile
          user={meInfo}
          selfMuted={muted}
          deafened={deafened}
          speaking={meSpeaking}
          size="md"
          videoStream={localCameraStream}
          mirror
        />
        {people
          .filter((p) => p.id !== focused.userId && !availableScreens.includes(p.id))
          .map((p) => (
            <ParticipantTile
              key={p.id}
              user={p}
              selfMuted={voiceStates[p.id]?.muted}
              onContextMenu={userMenuHandler(p.id, p.display_name, meId, p.username)}
              locallyMuted={localAudio[p.id]?.muted ?? false}
              deafened={voiceStates[p.id]?.deafened}
              serverMuted={voiceStates[p.id]?.serverMuted}
              serverDeafened={voiceStates[p.id]?.serverDeafened}
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
