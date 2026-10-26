import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { moveToVoiceChannel } from '../../call/api/calls'
import {
  StreamContextMenu,
  MaestroContextMenu,
  SelfUserMenu,
  StandardUserDMSection,
  StandardUserServerSection,
  UserVoiceMoveSection,
  UserVolumeSection,
  MENU_WIDTH
} from './UserContextMenuSections'
import {
  openUserProfile,
  copyUserId,
  sendDirectMessage,
  closeDirectMessage,
  startUserCall,
  sendUserFriendRequest,
  acceptUserFriendRequest,
  confirmUserRemoveFriend,
  confirmUserBlock,
  unblockUserTarget,
  promptEditNickname,
  computeVoiceMoveTargets,
  getAudioKey,
  canChangeServerNickname,
  resolveTargetUsername,
  computeGivableRoles,
  computeServerModerationPerms
} from '../lib/userMenuActions'
import { canMoveVoiceUser, voiceChannelOf } from '../../call/lib/voiceMove'
import router from '../../../app/router'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../../call/store/callStore'
import { useFriendStore, useRelationship } from '../../friends/store/friendStore'
import { useServerStore } from '../../servers/store/serverStore'
import { useServerAccess } from '../../servers/hooks/useServerAccess'
import { useModerationStore } from '../../call/store/moderationStore'
import { actionErrorMessage } from '../../servers/lib/permissionErrors'
import { Perm, type Role } from '../../servers/lib/permissions'
import { showToast } from '../../../shared/store/toastStore'
import { useUserAudioStore } from '../../call/store/userAudioStore'
import { useUserMenuStore, type UserMenuTarget } from '../store/userMenuStore'
import { isMaestroUser } from '../../music/lib/music'

const itemClass = 'cursor-pointer rounded px-2 py-1.5 text-left hover:bg-fg/5 disabled:opacity-50'

interface StandardUserMenuProps {
  target: UserMenuTarget
  audioKey: string
  audio: { volume: number; muted: boolean }
  meId?: string
  left: number
  top: number
  menuRef: React.RefObject<HTMLDivElement | null>
  close: () => void
}

function StandardUserMenu({
  target,
  audioKey,
  audio,
  meId,
  left,
  top,
  menuRef,
  close
}: StandardUserMenuProps): React.JSX.Element {
  const [saving, setSaving] = useState(false)
  const setVolume = useUserAudioStore((s) => s.setVolume)
  const toggleMuted = useUserAudioStore((s) => s.toggleMuted)
  const relationship = useRelationship(target.userId)
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const accept = useFriendStore((s) => s.accept)
  const unblock = useFriendStore((s) => s.unblock)
  const callIdle = useCallStore((s) => s.status === 'idle')
  const startDMCall = useCallStore((s) => s.startDMCall)
  const server = useServerStore((s) => s.currentServer)
  const member = useServerStore((s) => s.currentMembers.find((m) => m.user_id === target.userId))
  const roles = useServerStore((s) => s.roles)
  const addMemberRole = useServerStore((s) => s.addMemberRole)
  const removeMemberRole = useServerStore((s) => s.removeMemberRole)
  const channels = useServerStore((s) => s.channels)
  const serverCalls = useCallStore((s) => s.serverCalls)
  const access = useServerAccess()

  const inCallWith = useCallStore(
    (s) => s.status === 'active' && s.participants.some((p) => p.id === target.userId)
  )
  const callUsername = useCallStore(
    (s) => s.participants.find((p) => p.id === target.userId)?.username
  )
  const username = resolveTargetUsername(target.username, member?.username, callUsername)
  const inServer = Boolean(server && member)
  const canAct = inServer && access.canActOnMember(target.userId)
  const givable: Role[] = computeGivableRoles(inServer, roles, access)

  const fromChannel = voiceChannelOf(serverCalls, target.userId)
  const voiceCall = fromChannel ? serverCalls[fromChannel] : undefined
  const voiceState = voiceCall?.participants.find((p) => p.user_id === target.userId)
  const voiceCallId = voiceCall?.call?.id

  const inFrom = (want: number): boolean =>
    Boolean(fromChannel && voiceCallId && access.canInChannel(fromChannel, want))

  const canMove = Boolean(
    fromChannel &&
      canMoveVoiceUser({
        meId,
        targetId: target.userId,
        canMoveMembers: access.canInChannel(fromChannel, Perm.MOVE_MEMBERS),
        canMoveTarget: access.canMoveMember(target.userId)
      })
  )
  const moveTargets = computeVoiceMoveTargets(fromChannel, channels, canMove)
  const canNick = canChangeServerNickname(
    inServer,
    router.state.location.pathname,
    server?.id ?? undefined,
    access.canChangeNickname(target.userId)
  )

  const modPerms = computeServerModerationPerms(
    canAct,
    access.canDisconnectMember(target.userId),
    inFrom,
    access.can
  )

  const moveTo = async (channelId: string, channelName: string): Promise<void> => {
    setSaving(true)
    try {
      await moveToVoiceChannel(target.userId, channelId)
      showToast.success(`${target.name} foi movido para ${channelName}.`)
      close()
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Não foi possível mover.'))
    } finally {
      setSaving(false)
    }
  }

  const moderate = async (action: () => Promise<unknown>, fallback: string): Promise<void> => {
    setSaving(true)
    try {
      await action()
      close()
    } catch (err) {
      showToast.error(actionErrorMessage(err, fallback))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Opções de ${target.name}`}
      style={{ left, top, width: MENU_WIDTH }}
      data-user-context-menu="true"
      className="fixed z-[80] flex max-h-[calc(100vh-16px)] flex-col gap-1 overflow-y-auto rounded-lg border border-subtle bg-floating p-2 text-sm text-gray-200 shadow-2xl"
    >
      <p className="truncate px-2 pb-1 pt-0.5 text-xs font-bold text-gray-400">{target.name}</p>

      <StandardUserDMSection
        target={target}
        username={username}
        relationship={relationship}
        callIdle={callIdle}
        itemClass={itemClass}
        onOpenProfile={() => {
          close()
          openUserProfile({ ...target, username })
        }}
        onSendMessage={() => {
          close()
          sendDirectMessage(target.userId)
        }}
        onCloseDm={() => {
          close()
          void closeDirectMessage(
            target.conversationId!,
            target.userId,
            router.state.location.pathname
          )
        }}
        onCall={() => {
          close()
          void startUserCall(target.userId, username ?? '', target.name, startDMCall)
        }}
        onAddFriend={() => {
          close()
          if (username) void sendUserFriendRequest(username, target.name, sendRequest)
        }}
        onAcceptRequest={() => {
          close()
          if (username) void acceptUserFriendRequest(username, accept)
        }}
        onAskRemove={() => {
          close()
          if (username) confirmUserRemoveFriend(target.userId, username, target.name)
        }}
        onAskBlock={() => {
          close()
          confirmUserBlock(target.userId, username ?? '', target.name)
        }}
        onDoUnblock={() => {
          close()
          unblockUserTarget(target.userId, unblock)
        }}
      />

      {inCallWith && (
        <>
          <div className="my-1 h-px bg-fg/10" />
          <UserVolumeSection
            label="Volume do usuário"
            muteLabel="Silenciar"
            volume={audio.volume}
            muted={audio.muted}
            onVolumeChange={(v) => setVolume(audioKey, v)}
            onToggleMute={() => toggleMuted(audioKey)}
          />
        </>
      )}

      <UserVoiceMoveSection
        moveTargets={moveTargets}
        saving={saving}
        itemClass={itemClass}
        onMoveTo={(id, name) => void moveTo(id, name)}
      />

      <div className="my-1 h-px bg-fg/10" />
      <button
        role="menuitem"
        onClick={() => {
          close()
          copyUserId(target.userId)
        }}
        className={itemClass}
      >
        Copiar ID do usuário
      </button>

      <StandardUserServerSection
        server={server}
        member={member}
        canNick={canNick}
        givable={givable}
        voiceCallId={voiceCallId}
        voiceState={voiceState}
        canMuteInVoice={modPerms.canMute}
        canDeafenInVoice={modPerms.canDeafen}
        canDisconnect={modPerms.canDisconnect}
        canKick={modPerms.canKick}
        canBan={modPerms.canBan}
        target={target}
        saving={saving}
        close={close}
        itemClass={itemClass}
        onEditNickname={() => {
          if (server && member) {
            close()
            promptEditNickname({
              serverId: server.id,
              userId: target.userId,
              name: target.name,
              nickname: member.nickname,
              displayName: member.display_name,
              self: false,
              askNickname: useModerationStore.getState().askNickname
            })
          }
        }}
        onToggleRole={(roleId, has) =>
          void moderate(
            () =>
              has
                ? removeMemberRole(server!.id, member!.user_id, roleId)
                : addMemberRole(server!.id, member!.user_id, roleId),
            'Não foi possível mudar o cargo.'
          )
        }
        onModerate={moderate}
      />
    </div>
  )
}

/**
 * Menu de contexto de usuário. Exibe as opções específicas para streams,
 * robô Maestro, o próprio usuário autenticado ou membros do servidor / contatos.
 */
function UserContextMenu(): React.JSX.Element | null {
  const target = useUserMenuStore((s) => s.target)
  const close = useUserMenuStore((s) => s.close)
  const meId = useAuthStore((s) => s.user?.id)
  const audioKey = getAudioKey(target)
  const audio = useUserAudioStore((s) => (target ? s.get(audioKey) : null))
  const setVolume = useUserAudioStore((s) => s.setVolume)
  const toggleMuted = useUserAudioStore((s) => s.toggleMuted)
  const server = useServerStore((s) => s.currentServer)
  const member = useServerStore((s) => s.currentMembers.find((m) => m.user_id === target?.userId))
  const access = useServerAccess()
  const ref = useRef<HTMLDivElement | null>(null)
  const [menuHeight, setMenuHeight] = useState<number>(420)

  useLayoutEffect(() => {
    if (ref.current) setMenuHeight(ref.current.offsetHeight)
  }, [target])

  useEffect(() => {
    if (!target) return
    const onDown = (e: MouseEvent): void => {
      const node = e.target as Node
      if (ref.current?.contains(node) || target.anchorEl?.contains(node)) return
      close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [target, close])

  if (!target || !audio) return null

  const left = Math.max(8, Math.min(target.x, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.max(8, Math.min(target.y, window.innerHeight - (menuHeight || 420) - 8))

  const renderVolume = (label: string, muteLabel: string): React.JSX.Element => (
    <UserVolumeSection
      label={label}
      muteLabel={muteLabel}
      volume={audio.volume}
      muted={audio.muted}
      onVolumeChange={(v) => setVolume(audioKey, v)}
      onToggleMute={() => toggleMuted(audioKey)}
    />
  )

  if (target.stream) {
    return (
      <StreamContextMenu
        target={target}
        left={left}
        top={top}
        menuRef={ref}
        renderVolumeControls={renderVolume}
      />
    )
  }

  if (isMaestroUser(target.userId)) {
    return (
      <MaestroContextMenu
        target={target}
        left={left}
        top={top}
        server={server}
        meId={meId}
        itemClass={itemClass}
        menuRef={ref}
        close={close}
        renderVolumeControls={renderVolume}
      />
    )
  }

  if (target.userId === meId) {
    const canSelfNick = canChangeServerNickname(
      Boolean(server && member),
      router.state.location.pathname,
      server?.id,
      access.canChangeNickname(target.userId)
    )

    return (
      <SelfUserMenu
        target={target}
        server={server}
        member={member}
        canNick={canSelfNick}
        left={left}
        top={top}
        menuRef={ref}
        close={close}
        onEditNickname={() => {
          if (server && member) {
            close()
            promptEditNickname({
              serverId: server.id,
              userId: target.userId,
              name: target.name,
              nickname: member.nickname,
              displayName: member.display_name,
              self: true,
              askNickname: useModerationStore.getState().askNickname
            })
          }
        }}
        onOpenProfile={() => {
          close()
          openUserProfile({ ...target, username: member?.username })
        }}
        onCopyId={() => {
          close()
          copyUserId(target.userId)
        }}
        itemClass={itemClass}
      />
    )
  }

  return (
    <StandardUserMenu
      target={target}
      audioKey={audioKey}
      audio={audio}
      meId={meId}
      left={left}
      top={top}
      menuRef={ref}
      close={close}
    />
  )
}

export default UserContextMenu
