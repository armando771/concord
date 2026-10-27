import { disconnectParticipant, setServerDeafen, setServerMute } from '../../call/api/calls'
import { useModerationStore } from '../../call/store/moderationStore'

export interface UserContextMenuModerationProps {
  serverId?: string
  voiceCallId?: string
  targetUserId: string
  targetName: string
  serverMuted?: boolean
  serverDeafened?: boolean
  canMuteInVoice: boolean
  canDeafenInVoice: boolean
  canDisconnect: boolean
  canKick: boolean
  canBan: boolean
  itemClass: string
  saving: boolean
  close: () => void
  onModerate: (action: () => Promise<unknown>, fallback: string) => Promise<void>
}

interface VoiceSectionProps {
  voiceCallId: string
  targetUserId: string
  serverMuted?: boolean
  serverDeafened?: boolean
  canMuteInVoice: boolean
  canDeafenInVoice: boolean
  canDisconnect: boolean
  itemClass: string
  saving: boolean
  onModerate: (action: () => Promise<unknown>, fallback: string) => Promise<void>
}

export function VoiceModerationSection({
  voiceCallId,
  targetUserId,
  serverMuted,
  serverDeafened,
  canMuteInVoice,
  canDeafenInVoice,
  canDisconnect,
  itemClass,
  saving,
  onModerate
}: VoiceSectionProps): React.JSX.Element | null {
  if (!canMuteInVoice && !canDeafenInVoice && !canDisconnect) return null

  return (
    <>
      <div className="my-1 h-px bg-fg/10" />
      <p className="px-2 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Voz</p>
      {canMuteInVoice && (
        <button
          role="menuitem"
          disabled={saving}
          onClick={() =>
            void onModerate(
              () => setServerMute(voiceCallId, targetUserId, !serverMuted),
              'Não foi possível silenciar.'
            )
          }
          className={itemClass}
        >
          {serverMuted ? 'Liberar a fala no servidor' : 'Silenciar no servidor'}
        </button>
      )}
      {canDeafenInVoice && (
        <button
          role="menuitem"
          disabled={saving}
          onClick={() =>
            void onModerate(
              () => setServerDeafen(voiceCallId, targetUserId, !serverDeafened),
              'Não foi possível ensurdecer.'
            )
          }
          className={itemClass}
        >
          {serverDeafened ? 'Liberar o áudio no servidor' : 'Ensurdecer no servidor'}
        </button>
      )}
      {canDisconnect && (
        <button
          role="menuitem"
          disabled={saving}
          onClick={() =>
            void onModerate(
              () => disconnectParticipant(voiceCallId, targetUserId),
              'Não foi possível desconectar.'
            )
          }
          className={`${itemClass} text-danger`}
        >
          Desconectar da chamada
        </button>
      )}
    </>
  )
}

interface ServerSectionProps {
  serverId: string
  targetUserId: string
  targetName: string
  canKick: boolean
  canBan: boolean
  itemClass: string
  close: () => void
  askKick: (target: { serverId: string; userId: string; name: string }) => void
  askBan: (target: { serverId: string; userId: string; name: string }) => void
}

export function ServerModerationSection({
  serverId,
  targetUserId,
  targetName,
  canKick,
  canBan,
  itemClass,
  close,
  askKick,
  askBan
}: ServerSectionProps): React.JSX.Element | null {
  if (!canKick && !canBan) return null

  return (
    <>
      <div className="my-1 h-px bg-fg/10" />
      {canKick && (
        <button
          role="menuitem"
          onClick={() => {
            close()
            askKick({ serverId, userId: targetUserId, name: targetName })
          }}
          className={`${itemClass} text-danger`}
        >
          Expulsar {targetName}
        </button>
      )}
      {canBan && (
        <button
          role="menuitem"
          onClick={() => {
            close()
            askBan({ serverId, userId: targetUserId, name: targetName })
          }}
          className={`${itemClass} text-danger`}
        >
          Banir {targetName}
        </button>
      )}
    </>
  )
}

export function UserContextMenuModeration(
  props: UserContextMenuModerationProps
): React.JSX.Element | null {
  const askKick = useModerationStore((s) => s.askKick)
  const askBan = useModerationStore((s) => s.askBan)

  return (
    <>
      {props.voiceCallId && (
        <VoiceModerationSection
          voiceCallId={props.voiceCallId}
          targetUserId={props.targetUserId}
          serverMuted={props.serverMuted}
          serverDeafened={props.serverDeafened}
          canMuteInVoice={props.canMuteInVoice}
          canDeafenInVoice={props.canDeafenInVoice}
          canDisconnect={props.canDisconnect}
          itemClass={props.itemClass}
          saving={props.saving}
          onModerate={props.onModerate}
        />
      )}
      {props.serverId && (
        <ServerModerationSection
          serverId={props.serverId}
          targetUserId={props.targetUserId}
          targetName={props.targetName}
          canKick={props.canKick}
          canBan={props.canBan}
          itemClass={props.itemClass}
          close={props.close}
          askKick={askKick}
          askBan={askBan}
        />
      )}
    </>
  )
}

export default UserContextMenuModeration
