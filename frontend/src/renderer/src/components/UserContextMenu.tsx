import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  disconnectParticipant,
  moveToVoiceChannel,
  setServerDeafen,
  setServerMute
} from '../api/calls'
import { canMoveVoiceUser, voiceChannelOf } from '../lib/voiceMove'
import router from '../router'
import { useAuthStore } from '../store/authStore'
import { useCallStore } from '../store/callStore'
import { useFriendStore, useRelationship } from '../store/friendStore'
import { useChatStore } from '../store/chatStore'
import { useProfileCardStore } from '../store/profileCardStore'
import { getOrCreateConversationWith, hideConversation } from '../api/conversations'
import { confirmBlock, confirmRemoveFriend } from '../store/friendActionsStore'
import { useServerStore } from '../store/serverStore'
import { useServerAccess } from '../store/useServerAccess'
import { useModerationStore } from '../store/moderationStore'
import { actionErrorMessage } from '../lib/permissionErrors'
import { Perm, roleColorCss } from '../lib/permissions'
import { assignableRoles } from '../lib/roleList'
import { showToast } from '../store/toastStore'
import { streamAudioKey, useUserAudioStore } from '../store/userAudioStore'
import { useUserMenuStore } from '../store/userMenuStore'
import { friendRequestError } from '../lib/relationship'
import { disableMaestro } from '../api/music'
import { isMaestroIdentity, isMaestroUser, T18 } from '../lib/music'
import { serverIdFromPath } from '../lib/serverNames'

const MENU_WIDTH = 232

const itemClass = 'cursor-pointer rounded px-2 py-1.5 text-left hover:bg-fg/5 disabled:opacity-50'

/**
 * Botão direito em um usuário (como no Discord): perfil, mensagem, ligar,
 * amizade (adicionar/aceitar/remover), bloquear e copiar ID para todos; volume e silenciar para quem está na chamada com você. Dentro de um servidor, o
 * que sobra depende dos cargos de quem abre o menu: dar/tirar cargos, expulsar,
 * banir e, na voz, mover, silenciar, ensurdecer e desconectar (sempre só quem
 * está abaixo do seu cargo mais alto).
 */
function UserContextMenu(): React.JSX.Element | null {
  const target = useUserMenuStore((s) => s.target)
  const close = useUserMenuStore((s) => s.close)
  const meId = useAuthStore((s) => s.user?.id)
  const inCallWith = useCallStore(
    (s) => s.status === 'active' && s.participants.some((p) => p.id === target?.userId)
  )
  const callUsername = useCallStore(
    (s) => s.participants.find((p) => p.id === target?.userId)?.username
  )
  // Menu da live usa o volume da live; menu da pessoa, o da voz dela.
  const audioKey = target ? (target.stream ? streamAudioKey(target.userId) : target.userId) : ''
  const audio = useUserAudioStore((s) => (target ? s.get(audioKey) : null))
  const setVolume = useUserAudioStore((s) => s.setVolume)
  const toggleMuted = useUserAudioStore((s) => s.toggleMuted)
  const relationship = useRelationship(target?.userId)
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const accept = useFriendStore((s) => s.accept)
  const unblock = useFriendStore((s) => s.unblock)
  const callIdle = useCallStore((s) => s.status === 'idle')
  const startDMCall = useCallStore((s) => s.startDMCall)
  const server = useServerStore((s) => s.currentServer)
  const member = useServerStore((s) => s.currentMembers.find((m) => m.user_id === target?.userId))
  const roles = useServerStore((s) => s.roles)
  const addMemberRole = useServerStore((s) => s.addMemberRole)
  const removeMemberRole = useServerStore((s) => s.removeMemberRole)
  const askKick = useModerationStore((s) => s.askKick)
  const askBan = useModerationStore((s) => s.askBan)
  const askNickname = useModerationStore((s) => s.askNickname)
  const access = useServerAccess()
  const channels = useServerStore((s) => s.channels)
  const serverCalls = useCallStore((s) => s.serverCalls)
  const ref = useRef<HTMLDivElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [menuHeight, setMenuHeight] = useState<number>(420)

  useLayoutEffect(() => {
    if (ref.current) {
      setMenuHeight(ref.current.offsetHeight)
    }
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

  const volumeControls = (label: string, muteLabel: string): React.JSX.Element => (
    <>
      <label className="flex flex-col gap-1.5 rounded px-2 py-1.5">
        <span className="text-xs font-semibold text-gray-300">
          {label} · {Math.round(audio.volume * 100)}%
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(audio.volume * 100)}
          onChange={(e) => setVolume(audioKey, Number(e.target.value) / 100)}
          aria-label={label}
          className="accent-brand"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-fg/5">
        <span>{muteLabel}</span>
        <input
          type="checkbox"
          checked={audio.muted}
          onChange={() => toggleMuted(audioKey)}
          className="h-4 w-4 accent-danger"
        />
      </label>
    </>
  )

  // Botão direito na live de alguém: só o som da live.
  if (target.stream) {
    return (
      <div
        ref={ref}
        role="menu"
        aria-label={`Transmissão de ${target.name}`}
        style={{ left, top, width: MENU_WIDTH }}
        data-user-context-menu="true"
        className="fixed z-[80] flex max-h-[calc(100vh-16px)] flex-col gap-1 overflow-y-auto rounded-lg border border-subtle bg-floating p-2 text-sm text-gray-200 shadow-2xl"
      >
        <p className="truncate px-2 pb-1 pt-0.5 text-xs font-bold text-gray-400">
          Transmissão de {target.name}
        </p>
        {volumeControls('Volume da transmissão', 'Silenciar transmissão')}
      </div>
    )
  }

  // Maestro: só perfil e, para o dono do servidor, remover.
  if (isMaestroUser(target.userId)) {
    // No palco o id é `bot-music:<canal>` (não é um usuário): sem perfil, com volume.
    const onStage = isMaestroIdentity(target.userId)
    const removeMaestro = (): void => {
      close()
      if (!server || !window.confirm(T18.confirm)) return
      disableMaestro(server.id).catch((err) =>
        showToast.error(err instanceof Error ? err.message : 'Falha na operação.')
      )
    }
    const openMaestroProfile = (): void => {
      close()
      useProfileCardStore.getState().open({
        userId: target.userId,
        name: target.name,
        username: target.username,
        side: 'right',
        anchor: { top: target.y, left: target.x, right: target.x, bottom: target.y }
      })
    }
    return (
      <div
        ref={ref}
        role="menu"
        aria-label={`Opções de ${target.name}`}
        style={{ left, top, width: MENU_WIDTH }}
        data-user-context-menu="true"
        className="fixed z-[80] flex max-h-[calc(100vh-16px)] flex-col gap-1 overflow-y-auto rounded-lg border border-subtle bg-floating p-2 text-sm text-gray-200 shadow-2xl"
      >
        <p className="truncate px-2 pb-1 pt-0.5 text-xs font-bold text-gray-400">{target.name}</p>
        {onStage ? (
          volumeControls('Volume', 'Silenciar')
        ) : (
          <button role="menuitem" onClick={openMaestroProfile} className={itemClass}>
            Perfil
          </button>
        )}
        {server?.owner_id === meId && (
          <button role="menuitem" onClick={removeMaestro} className={`${itemClass} text-danger`}>
            {T18.remove}
          </button>
        )}
      </div>
    )
  }

  const username = target.username || member?.username || callUsername

  // Moderação: só dentro de um servidor, sobre quem é membro e está abaixo do seu cargo.
  const inServer = Boolean(server && member)
  // Apelido: só com o servidor aberto na tela (em DM o apelido não existe).
  const canNickname =
    inServer &&
    serverIdFromPath(router.state.location.pathname) === server?.id &&
    access.canChangeNickname(target.userId)
  const isSelf = target.userId === meId
  const editNickname = (): void => {
    if (!server || !member) return
    close()
    askNickname({
      serverId: server.id,
      userId: target.userId,
      name: target.name,
      nickname: member.nickname ?? null,
      displayName: member.display_name || member.username || target.name,
      self: isSelf
    })
  }
  const nicknameItem = canNickname && (
    <button role="menuitem" onClick={editNickname} className={itemClass}>
      Alterar apelido
    </button>
  )
  const canAct = inServer && access.canActOnMember(target.userId)
  const givable = inServer
    ? assignableRoles(roles, {
        isOwner: access.isOwner,
        actorHighest: access.highest,
        canManageRoles: access.can(Perm.MANAGE_ROLES)
      })
    : []
  const canKick = canAct && access.can(Perm.KICK_MEMBERS)
  const canBan = canAct && access.can(Perm.BAN_MEMBERS)

  const fromChannel = voiceChannelOf(serverCalls, target.userId)
  const voiceState = fromChannel
    ? serverCalls[fromChannel]?.participants.find((p) => p.user_id === target.userId)
    : undefined
  const voiceCallId = fromChannel ? serverCalls[fromChannel]?.call?.id : undefined
  const inFromChannel = (want: number): boolean =>
    Boolean(fromChannel && voiceCallId && access.canInChannel(fromChannel, want))
  const canMuteInVoice = canAct && inFromChannel(Perm.MUTE_MEMBERS)
  const canDeafenInVoice = canAct && inFromChannel(Perm.DEAFEN_MEMBERS)
  const canDisconnect = canAct && inFromChannel(Perm.MOVE_MEMBERS)
  const moveTargets =
    fromChannel &&
    canMoveVoiceUser({
      meId,
      targetId: target.userId,
      canMoveMembers: access.canInChannel(fromChannel, Perm.MOVE_MEMBERS),
      canActOnTarget: access.canActOnMember(target.userId)
    })
      ? channels.filter((ch) => ch.type === 'voice' && ch.id !== fromChannel)
      : []

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

  /** Roda uma ação de moderação e fecha o menu; erros viram aviso em português. */
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

  const sendMessage = (): void => {
    close()
    void router.navigate(`/dm/${target.userId}`)
  }

  const addFriend = async (): Promise<void> => {
    if (!username) return
    try {
      const result = await sendRequest(username)
      showToast.success(
        result === 'accepted'
          ? `Você e ${target.name} agora são amigos.`
          : `Pedido de amizade enviado para ${target.name}.`
      )
      close()
    } catch (err) {
      showToast.error(friendRequestError(err))
    }
  }

  const acceptRequest = async (): Promise<void> => {
    if (!username) return
    try {
      await accept(username)
      close()
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível aceitar.')
    }
  }

  const openProfile = (): void => {
    close()
    useProfileCardStore.getState().open({
      userId: target.userId,
      name: target.name,
      username,
      side: 'right',
      anchor: { top: target.y, left: target.x, right: target.x, bottom: target.y }
    })
  }

  const call = async (): Promise<void> => {
    close()
    try {
      const conv = await getOrCreateConversationWith(target.userId)
      await router.navigate(`/dm/${target.userId}`)
      await startDMCall(conv.id, {
        id: target.userId,
        username: username ?? '',
        display_name: target.name
      })
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível ligar.')
    }
  }

  const closeDm = async (): Promise<void> => {
    if (!target.conversationId) return
    const id = target.conversationId
    close()
    try {
      await hideConversation(id)
      useChatStore.setState((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }))
      if (router.state.location.pathname === `/dm/${target.userId}`) {
        void router.navigate('/friends')
      }
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível fechar a DM.')
    }
  }

  const copyId = (): void => {
    close()
    void navigator.clipboard?.writeText(target.userId)
    showToast.success('ID copiado.')
  }

  const askRemove = (): void => {
    close()
    if (username) confirmRemoveFriend({ userId: target.userId, username, name: target.name })
  }

  const askBlock = (): void => {
    close()
    confirmBlock({ userId: target.userId, username: username ?? '', name: target.name })
  }

  const doUnblock = (): void => {
    close()
    unblock(target.userId).catch((err) =>
      showToast.error(err instanceof Error ? err.message : 'Não foi possível desbloquear.')
    )
  }

  // Você mesmo (lista de membros): só perfil, apelido e ID.
  if (isSelf) {
    return (
      <div
        ref={ref}
        role="menu"
        aria-label={`Opções de ${target.name}`}
        style={{ left, top, width: MENU_WIDTH }}
        data-user-context-menu="true"
        className="fixed z-[80] flex max-h-[calc(100vh-16px)] flex-col gap-1 overflow-y-auto rounded-lg border border-subtle bg-floating p-2 text-ds-sm text-gray-200 shadow-2xl"
      >
        <p className="truncate px-2 pb-1 pt-0.5 text-ds-xs font-bold text-gray-400">
          {target.name}
        </p>
        <button role="menuitem" onClick={openProfile} className={itemClass}>
          Perfil
        </button>
        {nicknameItem}
        <div className="my-1 h-px bg-fg/10" />
        <button role="menuitem" onClick={copyId} className={itemClass}>
          Copiar ID do usuário
        </button>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Opções de ${target.name}`}
      style={{ left, top, width: MENU_WIDTH }}
      data-user-context-menu="true"
      className="fixed z-[80] flex max-h-[calc(100vh-16px)] flex-col gap-1 overflow-y-auto rounded-lg border border-subtle bg-floating p-2 text-sm text-gray-200 shadow-2xl"
    >
      <p className="truncate px-2 pb-1 pt-0.5 text-xs font-bold text-gray-400">{target.name}</p>

      <button role="menuitem" onClick={openProfile} className={itemClass}>
        Perfil
      </button>
      <button role="menuitem" onClick={sendMessage} className={itemClass}>
        Mensagem
      </button>
      {relationship === 'friend' && (
        <button
          role="menuitem"
          disabled={!callIdle}
          onClick={() => void call()}
          className={itemClass}
        >
          Ligar
        </button>
      )}
      {target.conversationId && (
        <button role="menuitem" onClick={() => void closeDm()} className={itemClass}>
          Fechar DM
        </button>
      )}

      <div className="my-1 h-px bg-fg/10" />
      {relationship === 'none' && username && (
        <button role="menuitem" onClick={() => void addFriend()} className={itemClass}>
          Adicionar amigo
        </button>
      )}
      {relationship === 'outgoing' && (
        <button role="menuitem" disabled className={itemClass}>
          Pedido de amizade enviado
        </button>
      )}
      {relationship === 'incoming' && (
        <button role="menuitem" onClick={() => void acceptRequest()} className={itemClass}>
          Aceitar pedido de amizade
        </button>
      )}
      {relationship === 'friend' && username && (
        <button role="menuitem" onClick={askRemove} className={`${itemClass} text-danger`}>
          Remover amigo
        </button>
      )}
      {relationship === 'blocked' ? (
        <button role="menuitem" onClick={doUnblock} className={itemClass}>
          Desbloquear
        </button>
      ) : (
        <button role="menuitem" onClick={askBlock} className={`${itemClass} text-danger`}>
          Bloquear
        </button>
      )}

      {inCallWith && (
        <>
          <div className="my-1 h-px bg-fg/10" />
          {volumeControls('Volume do usuário', 'Silenciar')}
        </>
      )}

      {moveTargets.length > 0 && (
        <>
          <div className="my-1 h-px bg-fg/10" />
          <p className="px-2 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Mover para
          </p>
          <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            {moveTargets.map((ch) => (
              <button
                key={ch.id}
                role="menuitem"
                disabled={saving}
                onClick={() => void moveTo(ch.id, ch.name)}
                className={`${itemClass} truncate`}
              >
                🔊 {ch.name}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="my-1 h-px bg-fg/10" />
      <button role="menuitem" onClick={copyId} className={itemClass}>
        Copiar ID do usuário
      </button>

      {nicknameItem && (
        <>
          <div className="my-1 h-px bg-fg/10" />
          {nicknameItem}
        </>
      )}

      {givable.length > 0 && member && server && (
        <>
          <div className="my-1 h-px bg-fg/10" />
          <p className="px-2 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Cargos
          </p>
          <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            {givable.map((role) => {
              const has = !!member.role_ids?.includes(role.id)
              return (
                <button
                  key={role.id}
                  role="menuitemcheckbox"
                  aria-checked={has}
                  disabled={saving}
                  onClick={() =>
                    void moderate(
                      () =>
                        has
                          ? removeMemberRole(server.id, member.user_id, role.id)
                          : addMemberRole(server.id, member.user_id, role.id),
                      'Não foi possível mudar o cargo.'
                    )
                  }
                  className={`${itemClass} flex items-center gap-2`}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: roleColorCss(role.color) ?? '#99aab5' }}
                  />
                  <span className="min-w-0 flex-1 truncate">{role.name}</span>
                  {has && <span className="text-success">✓</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      {(canMuteInVoice || canDeafenInVoice || canDisconnect) && voiceCallId && (
        <>
          <div className="my-1 h-px bg-fg/10" />
          <p className="px-2 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Voz
          </p>
          {canMuteInVoice && (
            <button
              role="menuitem"
              disabled={saving}
              onClick={() =>
                void moderate(
                  () => setServerMute(voiceCallId, target.userId, !voiceState?.server_muted),
                  'Não foi possível silenciar.'
                )
              }
              className={itemClass}
            >
              {voiceState?.server_muted ? 'Liberar a fala no servidor' : 'Silenciar no servidor'}
            </button>
          )}
          {canDeafenInVoice && (
            <button
              role="menuitem"
              disabled={saving}
              onClick={() =>
                void moderate(
                  () => setServerDeafen(voiceCallId, target.userId, !voiceState?.server_deafened),
                  'Não foi possível ensurdecer.'
                )
              }
              className={itemClass}
            >
              {voiceState?.server_deafened
                ? 'Liberar o áudio no servidor'
                : 'Ensurdecer no servidor'}
            </button>
          )}
          {canDisconnect && (
            <button
              role="menuitem"
              disabled={saving}
              onClick={() =>
                void moderate(
                  () => disconnectParticipant(voiceCallId, target.userId),
                  'Não foi possível desconectar.'
                )
              }
              className={`${itemClass} text-danger`}
            >
              Desconectar da chamada
            </button>
          )}
        </>
      )}

      {(canKick || canBan) && server && (
        <>
          <div className="my-1 h-px bg-fg/10" />
          {canKick && (
            <button
              role="menuitem"
              onClick={() => {
                close()
                askKick({ serverId: server.id, userId: target.userId, name: target.name })
              }}
              className={`${itemClass} text-danger`}
            >
              Expulsar {target.name}
            </button>
          )}
          {canBan && (
            <button
              role="menuitem"
              onClick={() => {
                close()
                askBan({ serverId: server.id, userId: target.userId, name: target.name })
              }}
              className={`${itemClass} text-danger`}
            >
              Banir {target.name}
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default UserContextMenu
