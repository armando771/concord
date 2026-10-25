import { useEffect, useRef, useState } from 'react'
import { setMemberRole } from '../api/servers'
import { moveToVoiceChannel } from '../api/calls'
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
import { showToast } from '../store/toastStore'
import { streamAudioKey, useUserAudioStore } from '../store/userAudioStore'
import { useUserMenuStore } from '../store/userMenuStore'
import { friendRequestError } from '../lib/relationship'
import { disableMaestro } from '../api/music'
import { MAESTRO_USER_ID, T18 } from '../lib/music'

const MENU_WIDTH = 232

const itemClass =
  'cursor-pointer rounded px-2 py-1.5 text-left hover:bg-white/5 disabled:opacity-50'

/**
 * Botão direito em um usuário (como no Discord): perfil, mensagem, ligar,
 * amizade (adicionar/aceitar/remover), bloquear e copiar ID para todos; volume e silenciar para quem está na chamada com você; para o dono
 * do servidor, tornar moderador; para moderadores, mover para outro canal de
 * voz.
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
  const amModerator = useServerStore(
    (s) =>
      Boolean(s.currentServer && s.currentServer.owner_id === meId) ||
      s.currentMembers.some((m) => m.user_id === meId && m.role === 'admin')
  )
  const channels = useServerStore((s) => s.channels)
  const serverCalls = useCallStore((s) => s.serverCalls)
  const ref = useRef<HTMLDivElement | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!target) return
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) close()
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

  const left = Math.min(target.x, window.innerWidth - MENU_WIDTH - 8)
  const top = Math.max(8, Math.min(target.y, window.innerHeight - 420))

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
          className="accent-[#5865f2]"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-white/5">
        <span>{muteLabel}</span>
        <input
          type="checkbox"
          checked={audio.muted}
          onChange={() => toggleMuted(audioKey)}
          className="h-4 w-4 accent-[#f23f43]"
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
        className="fixed z-[60] flex flex-col gap-1 rounded-lg border border-white/10 bg-[#111214] p-2 text-sm text-gray-200 shadow-2xl"
      >
        <p className="truncate px-2 pb-1 pt-0.5 text-xs font-bold text-gray-400">
          Transmissão de {target.name}
        </p>
        {volumeControls('Volume da transmissão', 'Silenciar transmissão')}
      </div>
    )
  }

  // Maestro: só perfil e, para o dono do servidor, remover.
  if (target.userId === MAESTRO_USER_ID) {
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
        className="fixed z-[60] flex flex-col gap-1 rounded-lg border border-white/10 bg-[#111214] p-2 text-sm text-gray-200 shadow-2xl"
      >
        <p className="truncate px-2 pb-1 pt-0.5 text-xs font-bold text-gray-400">{target.name}</p>
        <button role="menuitem" onClick={openMaestroProfile} className={itemClass}>
          Perfil
        </button>
        {server?.owner_id === meId && (
          <button role="menuitem" onClick={removeMaestro} className={`${itemClass} text-[#f23f43]`}>
            {T18.remove}
          </button>
        )}
      </div>
    )
  }

  const canSetRole = Boolean(
    server && member && server.owner_id === meId && member.user_id !== meId
  )
  const isModerator = member?.role === 'admin'
  const username = target.username || member?.username || callUsername

  const fromChannel = voiceChannelOf(serverCalls, target.userId)
  const moveTargets =
    fromChannel &&
    canMoveVoiceUser({
      meId,
      ownerId: server?.owner_id,
      isModerator: amModerator,
      targetId: target.userId
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
      showToast.error(err instanceof Error ? err.message : 'Não foi possível mover.')
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

  const toggleRole = async (): Promise<void> => {
    if (!server || !member) return
    setSaving(true)
    try {
      await setMemberRole(server.id, member.user_id, isModerator ? 'member' : 'admin')
      showToast.success(
        isModerator ? `${target.name} agora é membro.` : `${target.name} agora é moderador.`
      )
      close()
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível mudar o cargo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Opções de ${target.name}`}
      style={{ left, top, width: MENU_WIDTH }}
      className="fixed z-[60] flex flex-col gap-1 rounded-lg border border-white/10 bg-[#111214] p-2 text-sm text-gray-200 shadow-2xl"
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

      <div className="my-1 h-px bg-white/10" />
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
        <button role="menuitem" onClick={askRemove} className={`${itemClass} text-[#f23f43]`}>
          Remover amigo
        </button>
      )}
      {relationship === 'blocked' ? (
        <button role="menuitem" onClick={doUnblock} className={itemClass}>
          Desbloquear
        </button>
      ) : (
        <button role="menuitem" onClick={askBlock} className={`${itemClass} text-[#f23f43]`}>
          Bloquear
        </button>
      )}

      {inCallWith && (
        <>
          <div className="my-1 h-px bg-white/10" />
          {volumeControls('Volume do usuário', 'Silenciar')}
        </>
      )}

      {moveTargets.length > 0 && (
        <>
          <div className="my-1 h-px bg-white/10" />
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

      <div className="my-1 h-px bg-white/10" />
      <button role="menuitem" onClick={copyId} className={itemClass}>
        Copiar ID do usuário
      </button>

      {canSetRole && (
        <>
          <div className="my-1 h-px bg-white/10" />
          <button
            role="menuitem"
            disabled={saving}
            onClick={() => void toggleRole()}
            className={itemClass}
          >
            {isModerator ? 'Remover moderador' : 'Tornar moderador'}
          </button>
        </>
      )}
    </div>
  )
}

export default UserContextMenu
