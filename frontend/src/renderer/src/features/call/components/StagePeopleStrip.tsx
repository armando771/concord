import type { CallPerson } from '../lib/callParticipants'
import type { ScreenEntry } from '../lib/screenWatch'
import { stripPeople } from '../lib/stagePeople'
import { useCallStore } from '../store/callStore'
import type { CallUserInfo } from '../store/callStore'
import { MeTile, PersonTile, ScreenTile } from './StageTiles'

/**
 * Faixa de pessoas embaixo de uma transmissão ou vídeo em destaque: as outras
 * telas, eu e quem não está transmitindo. `exceptId` é quem já está em cima.
 */
function StagePeopleStrip({
  screens,
  meInfo,
  people,
  nameOf,
  speaking,
  exceptId
}: {
  screens: ScreenEntry[]
  meInfo: CallUserInfo
  people: CallPerson[]
  nameOf: (userId: string) => CallUserInfo
  speaking?: Set<string>
  exceptId?: string
}): React.JSX.Element {
  const availableScreens = useCallStore((s) => s.availableScreens)
  const localCameraStream = useCallStore((s) => s.localCameraStream)
  const videoStreams = useCallStore((s) => s.videoStreams)

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
      {screens
        .filter((entry) => entry.userId !== exceptId)
        .map((entry) => (
          <ScreenTile key={entry.userId} entry={entry} user={nameOf(entry.userId)} size="md" />
        ))}
      <MeTile info={meInfo} speaking={speaking} size="md" video={localCameraStream} />
      {stripPeople(people, availableScreens, exceptId).map((p) => (
        <PersonTile
          key={p.id}
          user={p}
          speaking={speaking}
          size="md"
          video={videoStreams[p.id] ?? null}
        />
      ))}
    </div>
  )
}

export default StagePeopleStrip
