import type { Channel } from '../api/channels'
import { useCallStore } from '../../call/store/callStore'
import VoiceChannelTimer from '../../call/components/VoiceChannelTimer'
import { LockIcon, VolumeIcon } from '../../../shared/ui/icons'
import { useServerStore } from '../store/serverStore'
import { useVoiceParticipants } from '../hooks/useVoiceParticipants'
import { useVoiceUserDrop, type ChannelDropTarget } from '../hooks/useVoiceUserDrop'
import { Perm } from '../lib/permissions'
import type { ServerAccess } from '../lib/serverAccess'
import { isConnectedTo, voiceRowClass, voiceRowTitle, WRAP_NAME } from '../lib/voiceChannelRow'
import VoiceKnockOverlay from './VoiceKnockOverlay'
import VoiceChannelMembers from './VoiceChannelMembers'

/** Tempo da chamada e quantas pessoas, na altura da primeira linha do nome. */
function VoiceChannelMeta({
  people,
  startedAt,
  fadeOnHover
}: {
  people: number
  startedAt?: string
  /** Com gente no canal, o "•••" troca de lugar com a contagem no hover. */
  fadeOnHover: boolean
}): React.JSX.Element | null {
  if (people === 0) return null
  return (
    <>
      {startedAt && (
        <span className="flex h-6 shrink-0 items-center">
          <VoiceChannelTimer startedAt={startedAt} />
        </span>
      )}
      <span
        className={`flex h-6 shrink-0 items-center transition-opacity ${
          fadeOnHover ? 'group-hover/voicech:opacity-0' : ''
        }`}
      >
        <span className="rounded-full bg-fg/10 px-1.5 py-0.2 text-[10px] font-bold text-gray-300">
          {people}
        </span>
      </span>
    </>
  )
}

interface VoiceChannelButtonProps {
  channel: Channel
  access: ServerAccess
  connectedHere: boolean
  people: number
  startedAt?: string
  locked: boolean
  dropActive: boolean
  hasMenu: boolean
  onJoin: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

/** O canal em si: clicar conecta (ou desconecta, se já estou nele). */
function VoiceChannelButton({
  channel,
  access,
  connectedHere,
  people,
  startedAt,
  locked,
  dropActive,
  hasMenu,
  onJoin,
  onContextMenu
}: VoiceChannelButtonProps): React.JSX.Element {
  const canConnect = access.canInChannel(channel.id, Perm.CONNECT)
  const isPrivate = access.isPrivate(channel.id)
  return (
    <button
      onClick={onJoin}
      onContextMenu={onContextMenu}
      title={voiceRowTitle(connectedHere, canConnect)}
      className={voiceRowClass({
        canConnect,
        hasMenu,
        hasPeople: people > 0,
        dropActive,
        connectedHere
      })}
    >
      {/* Verde só nos canais com gente (pode ser em vários ao mesmo tempo). */}
      <span className="flex h-6 shrink-0 items-center">
        <VolumeIcon
          className={`h-5 w-5 transition-colors ${people > 0 ? 'text-success' : 'text-gray-500'}`}
        />
      </span>
      {/* Nome inteiro, quebrando linha; tempo e contagem ficam na altura da
          primeira linha. */}
      <span title={channel.name} className={`min-w-0 flex-1 leading-6 ${WRAP_NAME}`}>
        {channel.name}
        {locked && (
          <span title="Sala trancada" className="ml-1.5 inline-flex align-[-1px] text-amber-500/90">
            <LockIcon className="h-3 w-3" />
            <span className="sr-only">(trancada)</span>
          </span>
        )}
        {(isPrivate || !canConnect) && (
          <span
            title={isPrivate ? 'Canal privado' : 'Sem permissão para entrar'}
            className="ml-1.5 inline-flex align-[-1px] text-gray-500"
          >
            <LockIcon className="h-3 w-3" />
            <span className="sr-only">(restrito)</span>
          </span>
        )}
      </span>
      <VoiceChannelMeta people={people} startedAt={startedAt} fadeOnHover={hasMenu} />
    </button>
  )
}

export interface VoiceChannelRowProps {
  channel: Channel
  access: ServerAccess
  /** Este canal é o que está sendo arrastado (reordenar). */
  dragging: boolean
  /** Linha de soltar (reordenar), ou nada. */
  dropLine: React.ReactNode
  dropTarget: ChannelDropTarget
  dragSource: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean }
  onJoin: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  /** O "•••" do canal (só quem abre o menu); onHover = só aparece no hover. */
  renderMenuButton?: (onHover: boolean) => React.ReactNode
  /** O menu do canal, quando aberto. */
  menu?: React.ReactNode
}

/** Um canal de voz na barra de canais, com quem está nele. */
function VoiceChannelRow({
  channel,
  access,
  dragging,
  dropLine,
  dropTarget,
  dragSource,
  onJoin,
  onContextMenu,
  renderMenuButton,
  menu
}: VoiceChannelRowProps): React.JSX.Element {
  const serverId = useServerStore((s) => s.currentServer?.id)
  const entry = useCallStore((s) => s.serverCalls[channel.id])
  const connectedHere = useCallStore((s) => isConnectedTo(s, channel.id))
  const participants = useVoiceParticipants(entry, serverId)
  const drop = useVoiceUserDrop(channel.id, participants, dropTarget)
  const locked = Boolean(entry?.call?.locked)
  return (
    <div
      className={`relative transition-opacity ${dragging ? 'opacity-40' : ''}`}
      {...drop.handlers}
    >
      {/* O "•••" é absoluto, alinhado à primeira linha do nome: precisa ficar
          preso à linha do canal, não ao bloco todo (que cresce com a lista). */}
      {dropLine}
      <div className="group/voicech relative" {...dragSource}>
        <VoiceChannelButton
          channel={channel}
          access={access}
          connectedHere={connectedHere}
          people={participants.length}
          startedAt={entry?.call?.started_at}
          locked={locked}
          dropActive={drop.active}
          hasMenu={Boolean(renderMenuButton)}
          onJoin={onJoin}
          onContextMenu={onContextMenu}
        />
        {renderMenuButton?.(participants.length > 0)}
        {menu}
        <VoiceKnockOverlay
          channelId={channel.id}
          locked={locked}
          connectedHere={connectedHere}
          onJoin={onJoin}
        />
      </div>
      <VoiceChannelMembers
        channelId={channel.id}
        participants={participants}
        connectedHere={connectedHere}
        access={access}
        onDragEnd={drop.clear}
      />
    </div>
  )
}

export default VoiceChannelRow
