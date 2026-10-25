import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import router from '../router'
import { useAuthStore } from '../store/authStore'
import { useCallStore } from '../store/callStore'
import { useChatStore } from '../store/chatStore'
import { useFriendStore } from '../store/friendStore'
import { useLevelStore } from '../store/levelStore'
import { useProfileCardStore } from '../store/profileCardStore'
import { useServerStore } from '../store/serverStore'
import { showToast } from '../store/toastStore'
import { formatMemberSince, placeProfileCard } from '../lib/profileCard'
import { levelTier } from '../lib/levels'
import { voiceChannelOf } from '../lib/voiceMove'
import LevelBadge from './level/LevelBadge'
import { VolumeIcon } from './icons'

const CARD_WIDTH = 300

const ROLE_STYLE = {
  owner: { label: 'Dono do servidor', color: '#f59e0b', avatar: 'bg-amber-600' },
  admin: { label: 'Moderador', color: '#8b5cf6', avatar: 'bg-violet-600' },
  member: { label: 'Membro', color: '#6366f1', avatar: 'bg-indigo-600' }
} as const

/**
 * Perfil da pessoa no servidor, como no Discord: abre ao clicar nela na lista
 * de membros ou no canal de voz. Mostra cargo, desde quando é membro, nível,
 * se está em call e atalhos para mensagem e amizade.
 */
function UserProfileCard(): React.JSX.Element | null {
  const target = useProfileCardStore((s) => s.target)
  const close = useProfileCardStore((s) => s.close)
  const meId = useAuthStore((s) => s.user?.id)
  const server = useServerStore((s) => s.currentServer)
  const member = useServerStore((s) => s.currentMembers.find((m) => m.user_id === target?.userId))
  const channels = useServerStore((s) => s.channels)
  const online = useChatStore((s) => (target ? Boolean(s.presence[target.userId]) : false))
  const serverCalls = useCallStore((s) => s.serverCalls)
  const level = useLevelStore((s) => (target ? s.levels[target.userId] : undefined))
  const ensureLevels = useLevelStore((s) => s.ensureLevels)
  const isFriend = useFriendStore((s) => s.friends.some((f) => f.id === target?.userId))
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (target) ensureLevels([target.userId])
  }, [target, ensureLevels])

  // Mede o cartão e posiciona ao lado do item clicado, dentro da janela.
  useLayoutEffect(() => {
    if (!target || !ref.current) {
      setPos(null)
      return
    }
    const { height } = ref.current.getBoundingClientRect()
    setPos(
      placeProfileCard(
        target.anchor,
        target.side,
        { width: CARD_WIDTH, height },
        { width: window.innerWidth, height: window.innerHeight }
      )
    )
  }, [target])

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
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [target, close])

  if (!target) return null

  const isMe = target.userId === meId
  const roleKey =
    server?.owner_id === target.userId ? 'owner' : member?.role === 'admin' ? 'admin' : 'member'
  const role = ROLE_STYLE[roleKey]
  const name = member?.display_name || target.name
  const username = member?.username || target.username
  const since = formatMemberSince(member?.joined_at)
  const voiceChannelId = voiceChannelOf(serverCalls, target.userId)
  const voiceChannel = voiceChannelId ? channels.find((c) => c.id === voiceChannelId) : undefined
  const tier = level !== undefined ? levelTier(level) : null

  const sendMessage = (): void => {
    close()
    void router.navigate(`/dm/${target.userId}`)
  }

  const addFriend = async (): Promise<void> => {
    if (!username) return
    setSending(true)
    try {
      await sendRequest(username)
      showToast.success(`Pedido de amizade enviado para ${name}.`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Perfil de ${name}`}
      style={{
        width: CARD_WIDTH,
        left: pos?.left ?? -9999,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden'
      }}
      className="fixed z-[60] overflow-hidden rounded-xl border border-white/10 bg-[#111214] text-sm text-gray-200 shadow-2xl"
    >
      {/* Banner na cor do cargo, puxando para a cor da faixa de nível. */}
      <div
        className="h-16"
        style={{
          backgroundImage: `linear-gradient(135deg, ${role.color}, ${tier?.color ?? role.color})`
        }}
      />

      <div className="px-4 pb-4">
        <div className="-mt-9 flex items-end justify-between">
          <div className="relative">
            <div
              className={`flex h-[72px] w-[72px] items-center justify-center rounded-full border-[5px] border-[#111214] text-2xl font-bold text-white ${role.avatar}`}
            >
              {name.charAt(0).toUpperCase()}
            </div>
            <span
              title={online ? 'Online' : 'Offline'}
              className={`absolute bottom-0.5 right-0.5 h-5 w-5 rounded-full border-4 border-[#111214] ${
                online ? 'bg-[#23a55a]' : 'bg-gray-600'
              }`}
            />
          </div>
          <LevelBadge userId={target.userId} size="md" className="mb-1" />
        </div>

        <div className="mt-2">
          <p className="truncate text-lg font-bold text-white">
            {name}
            {isMe && <span className="ml-1.5 text-xs font-medium text-gray-400">(você)</span>}
          </p>
          {username && <p className="truncate text-xs text-gray-400">@{username}</p>}
        </div>

        <div className="mt-3 flex flex-col gap-3 rounded-lg bg-black/30 p-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Cargo
            </p>
            <span
              className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-0.5 text-xs font-semibold"
              style={{ color: role.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: role.color }} />
              {role.label}
            </span>
          </div>

          {tier && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Nível de voz
              </p>
              <p className="text-xs text-gray-200">
                Nível {level} · <span style={{ color: tier.color }}>Faixa {tier.name}</span>
              </p>
            </div>
          )}

          {since && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Membro desde
              </p>
              <p className="text-xs text-gray-200">{since}</p>
            </div>
          )}

          {voiceChannel && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Em call
              </p>
              <p className="flex items-center gap-1.5 text-xs text-gray-200">
                <VolumeIcon className="h-3.5 w-3.5 text-[#23a55a]" />
                {voiceChannel.name}
              </p>
            </div>
          )}
        </div>

        {!isMe && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={sendMessage}
              className="flex-1 cursor-pointer rounded-lg bg-[#5865f2] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4752c4]"
            >
              Enviar mensagem
            </button>
            {!isFriend && username && (
              <button
                type="button"
                disabled={sending}
                onClick={() => void addFriend()}
                className="cursor-pointer rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                Adicionar amigo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserProfileCard
