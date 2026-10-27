import type { CallPerson } from '../lib/callParticipants'
import type { CallUserInfo } from '../store/callStore'
import { MeTile, PersonTile } from './StageTiles'

/** Voz pura: ninguém com tela nem câmera — grid de avatares. */
function VoiceGrid({
  gap,
  meInfo,
  people,
  speaking
}: {
  gap: string
  meInfo: CallUserInfo
  people: CallPerson[]
  speaking?: Set<string>
}): React.JSX.Element {
  return (
    <div className={`flex flex-wrap items-center justify-center ${gap}`}>
      <MeTile info={meInfo} speaking={speaking} />
      {people.map((p) => (
        <PersonTile key={p.id} user={p} speaking={speaking} />
      ))}
    </div>
  )
}

export default VoiceGrid
