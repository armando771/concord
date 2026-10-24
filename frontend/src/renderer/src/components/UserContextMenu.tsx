import { useEffect, useRef, useState } from 'react'
import { setMemberRole } from '../api/servers'
import router from '../router'
import { useAuthStore } from '../store/authStore'
import { useCallStore } from '../store/callStore'
import { useFriendStore } from '../store/friendStore'
import { useServerStore } from '../store/serverStore'
import { showToast } from '../store/toastStore'
import { streamAudioKey, useUserAudioStore } from '../store/userAudioStore'
import { useUserMenuStore } from '../store/userMenuStore'

const MENU_WIDTH = 232

const itemClass =
  'cursor-pointer rounded px-2 py-1.5 text-left hover:bg-white/5 disabled:opacity-50'

/**
 * Botão direito em um usuário (como no Discord): mensagem e amizade para
 * todos; volume e silenciar para quem está na chamada com você; para o dono
 * do servidor, tornar moderador.
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
  const isFriend = useFriendStore((s) => s.friends.some((f) => f.id === target?.userId))
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const server = useServerStore((s) => s.currentServer)
  const member = useServerStore((s) => s.currentMembers.find((m) => m.user_id === target?.userId))
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
  const top = Math.min(target.y, window.innerHeight - 280)

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

  const canSetRole = Boolean(
    server && member && server.owner_id === meId && member.user_id !== meId
  )
  const isModerator = member?.role === 'admin'
  const username = target.username || member?.username || callUsername

  const sendMessage = (): void => {
    close()
    void router.navigate(`/dm/${target.userId}`)
  }

  const addFriend = async (): Promise<void> => {
    if (!username) return
    try {
      await sendRequest(username)
      showToast.success(`Pedido de amizade enviado para ${target.name}.`)
      close()
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.')
    }
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

      <button role="menuitem" onClick={sendMessage} className={itemClass}>
        Enviar mensagem
      </button>
      {!isFriend && username && (
        <button role="menuitem" onClick={() => void addFriend()} className={itemClass}>
          Adicionar amigo
        </button>
      )}

      {inCallWith && (
        <>
          <div className="my-1 h-px bg-white/10" />
          {volumeControls('Volume do usuário', 'Silenciar')}
        </>
      )}

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
