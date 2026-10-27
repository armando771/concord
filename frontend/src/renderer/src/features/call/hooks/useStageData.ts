import { useEffect, useMemo } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useServerStore } from '../../servers/store/serverStore'
import { useCallNicknames } from '../../servers/hooks/useServerNames'
import { withServerNames } from '../../servers/lib/serverNames'
import { useLevelStore } from '../../levels/store/levelStore'
import { useCallStore } from '../store/callStore'
import type { CallUserInfo } from '../store/callStore'
import { mergeCallPeople, type CallPerson } from '../lib/callParticipants'
import { sortVoiceMembers } from '../lib/voiceOrder'
import { buildScreenEntries, type ScreenEntry } from '../lib/screenWatch'
import { buildCameraEntries, buildMeInfo, type CameraEntry } from '../lib/stagePeople'

export interface StageData {
  meId: string
  meInfo: CallUserInfo
  /** Os outros na chamada, na ordem da lista do canal (nível, entrada, nome). */
  people: CallPerson[]
  nameOf: (userId: string) => CallUserInfo
  screens: ScreenEntry[]
  cameras: CameraEntry[]
}

/** Quem está na chamada, suas telas e câmeras: o que o palco desenha. */
export function useStageData(): StageData {
  const me = useAuthStore((s) => s.user)
  const backendParticipants = useCallStore((s) => s.participants)
  const mediaPeers = useCallStore((s) => s.mediaPeers)
  const members = useServerStore((s) => s.currentMembers)
  const localScreenStream = useCallStore((s) => s.localScreenStream)
  const screenStreams = useCallStore((s) => s.screenStreams)
  const availableScreens = useCallStore((s) => s.availableScreens)
  const watchedScreenIds = useCallStore((s) => s.watchedScreenIds)
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

  const meInfo = buildMeInfo(me, nicknames?.[meId], meId)
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
  const cameras = buildCameraEntries(meId, localCameraStream, participants, videoStreams)

  return { meId, meInfo, people, nameOf, screens, cameras }
}
