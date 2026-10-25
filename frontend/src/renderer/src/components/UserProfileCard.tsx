import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import router from '../router'
import { useAuthStore } from '../store/authStore'
import { useCallStore } from '../store/callStore'
import { useChatStore } from '../store/chatStore'
import { useFriendStore } from '../store/friendStore'
import { useLevelStore } from '../store/levelStore'
import { useProfileCardStore } from '../store/profileCardStore'
import { useProfileStore } from '../store/profileStore'
import { useServerStore } from '../store/serverStore'
import { useSettingsStore } from '../store/settingsStore'
import { changeMyStatus } from '../store/meActions'
import { showToast } from '../store/toastStore'
import { formatMemberSince, placeProfileCard } from '../lib/profileCard'
import { levelTier } from '../lib/levels'
import { voiceChannelOf } from '../lib/voiceMove'
import { CHOSEN_STATUSES, STATUS_META, type PresenceStatus } from '../lib/presenceStatus'
import LevelBadge from './level/LevelBadge'
import ProfileCardBody, { CARD_BG, type CardProfile } from './profile/ProfileCardBody'
import StatusIcon from './StatusIcon'
import { PencilIcon, VolumeIcon } from './icons'

const CARD_WIDTH = 300
/** Altura aproximada do submenu de status (4 opções, duas com descrição). */
const STATUS_MENU_HEIGHT = 230

const ROLE_STYLE = {
  owner: { label: 'Dono do servidor', color: '#f59e0b', avatar: 'bg-amber-600' },
  admin: { label: 'Moderador', color: '#8b5cf6', avatar: 'bg-violet-600' },
  member: { label: 'Membro', color: '#6366f1', avatar: 'bg-indigo-600' }
} as const

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{children}</p>
  )
}

function MenuButton({
  icon,
  label,
  onClick,
  trailing
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  trailing?: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm font-medium text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  )
}

/** "Online ›" com o submenu dos status ao lado, como no Discord. */
function StatusMenu({ status }: { status: PresenceStatus }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [upward, setUpward] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const show = (): void => {
    // Perto do fim da janela (cartão da barra de baixo), abre para cima.
    const rect = ref.current?.getBoundingClientRect()
    setUpward(Boolean(rect && rect.top + STATUS_MENU_HEIGHT > window.innerHeight - 8))
    setOpen(true)
  }
  return (
    <div ref={ref} className="relative" onMouseEnter={show} onMouseLeave={() => setOpen(false)}>
      <MenuButton
        icon={<StatusIcon status={status} size={12} />}
        label={STATUS_META[status].label}
        onClick={() => (open ? setOpen(false) : show())}
        trailing={<span className="text-gray-400">›</span>}
      />
      {open && (
        // pl-3 em vez de margem: o mouse passa do botão para o menu sem fechar.
        <div className={`absolute left-full z-10 pl-3 ${upward ? 'bottom-0' : 'top-0'}`}>
          <div
            role="menu"
            className="w-64 rounded-lg border border-white/10 p-1.5 shadow-2xl"
            style={{ background: CARD_BG }}
          >
            {CHOSEN_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="menuitemradio"
                aria-checked={status === s}
                onClick={() => {
                  setOpen(false)
                  void changeMyStatus(s)
                }}
                className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/10"
              >
                <StatusIcon status={s} size={12} className="mt-1" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-100">
                    {STATUS_META[s].label}
                  </span>
                  {STATUS_META[s].description && (
                    <span className="block text-xs leading-snug text-gray-400">
                      {STATUS_META[s].description}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Perfil da pessoa, como no Discord: abre ao clicar nela na lista de membros,
 * no canal de voz ou (o próprio) na barra de baixo. Mostra banner, nota, Sobre
 * mim, links, cargo, nível e se está em call. No próprio perfil, a foto leva
 * ao editor e há o menu de status.
 */
function UserProfileCard(): React.JSX.Element | null {
  const target = useProfileCardStore((s) => s.target)
  const close = useProfileCardStore((s) => s.close)
  const me = useAuthStore((s) => s.user)
  const server = useServerStore((s) => s.currentServer)
  const member = useServerStore((s) => s.currentMembers.find((m) => m.user_id === target?.userId))
  const channels = useServerStore((s) => s.channels)
  const online = useChatStore((s) => (target ? Boolean(s.presence[target.userId]) : false))
  const knownStatus = useChatStore((s) => (target ? s.statuses[target.userId] : undefined))
  const serverCalls = useCallStore((s) => s.serverCalls)
  const level = useLevelStore((s) => (target ? s.levels[target.userId] : undefined))
  const ensureLevels = useLevelStore((s) => s.ensureLevels)
  const isFriend = useFriendStore((s) => s.friends.some((f) => f.id === target?.userId))
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const profile = useProfileStore((s) => (target ? s.profiles[target.userId] : undefined))
  const fetchProfile = useProfileStore((s) => s.fetchProfile)
  const openSettings = useSettingsStore((s) => s.openSettings)
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [sending, setSending] = useState(false)

  const isMe = Boolean(target && target.userId === me?.id)

  useEffect(() => {
    if (!target) return
    ensureLevels([target.userId])
    if (target.userId !== useAuthStore.getState().user?.id) void fetchProfile(target.userId)
  }, [target, ensureLevels, fetchProfile])

  // Mede o cartão e posiciona ao lado do item clicado, dentro da janela. O
  // perfil chega depois de abrir e muda a altura: mede de novo.
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
  }, [target, profile, me])

  useEffect(() => {
    if (!target) return
    const onDown = (e: MouseEvent): void => {
      const node = e.target as Node
      // No item que abriu o cartão, o próprio clique fecha (toggle).
      if (ref.current?.contains(node) || target.anchorEl?.contains(node)) return
      close()
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

  const inServer = Boolean(server && member)
  const roleKey =
    server?.owner_id === target.userId ? 'owner' : member?.role === 'admin' ? 'admin' : 'member'
  const role = ROLE_STYLE[roleKey]
  const tier = level !== undefined ? levelTier(level) : null

  const source = isMe ? me : profile
  const card: CardProfile = {
    id: target.userId,
    display_name: source?.display_name || member?.display_name || target.name,
    username: source?.username || member?.username || target.username,
    avatar_url: source ? source.avatar_url : member?.avatar_url,
    banner_url: source?.banner_url,
    banner_color: source?.banner_color,
    pronouns: source?.pronouns,
    bio: source?.bio,
    status_text: source?.status_text,
    links: source?.links?.map((l) => l.url) ?? []
  }
  const status: PresenceStatus = isMe
    ? (me?.status ?? 'online')
    : (knownStatus ?? profile?.status ?? (online ? 'online' : 'offline'))

  const salinhaSince = formatMemberSince(source?.created_at)
  const serverSince = inServer ? formatMemberSince(member?.joined_at) : null
  const voiceChannelId = voiceChannelOf(serverCalls, target.userId)
  const voiceChannel = voiceChannelId ? channels.find((c) => c.id === voiceChannelId) : undefined
  const fallbackBanner = `linear-gradient(135deg, ${role.color}, ${tier?.color ?? role.color})`

  const editProfile = (): void => {
    close()
    openSettings('profiles')
  }

  const copyId = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(target.userId)
      showToast.success('ID do usuário copiado.')
    } catch {
      showToast.error('Não foi possível copiar o ID.')
    }
    close()
  }

  const sendMessage = (): void => {
    close()
    void router.navigate(`/dm/${target.userId}`)
  }

  const addFriend = async (): Promise<void> => {
    if (!card.username) return
    setSending(true)
    try {
      await sendRequest(card.username)
      showToast.success(`Pedido de amizade enviado para ${card.display_name}.`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.')
    } finally {
      setSending(false)
    }
  }

  const hasInfo = inServer || tier || salinhaSince || voiceChannel

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Perfil de ${card.display_name}`}
      style={{
        width: CARD_WIDTH,
        left: pos?.left ?? -9999,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        background: CARD_BG
      }}
      className="fixed z-[60] rounded-xl border border-white/10 text-sm text-gray-200 shadow-2xl"
    >
      <ProfileCardBody
        profile={card}
        status={status}
        isMe={isMe}
        fallbackBanner={fallbackBanner}
        avatarFallbackClassName={role.avatar}
        badge={<LevelBadge userId={target.userId} size="md" />}
        onEditProfile={isMe ? editProfile : undefined}
      >
        {hasInfo && (
          <div className="mt-3 flex flex-col gap-3 rounded-lg bg-black/30 p-3">
            {inServer && (
              <div>
                <SectionTitle>Cargo</SectionTitle>
                <span
                  className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-0.5 text-xs font-semibold"
                  style={{ color: role.color }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: role.color }} />
                  {role.label}
                </span>
              </div>
            )}

            {tier && (
              <div>
                <SectionTitle>Nível de voz</SectionTitle>
                <p className="text-xs text-gray-200">
                  Nível {level} · <span style={{ color: tier.color }}>Faixa {tier.name}</span>
                </p>
              </div>
            )}

            {(salinhaSince || serverSince) && (
              <div>
                <SectionTitle>Membro desde</SectionTitle>
                <div className="flex flex-col gap-0.5 text-xs text-gray-200">
                  {salinhaSince && (
                    <p>
                      {salinhaSince} <span className="text-gray-500">· no Salinha</span>
                    </p>
                  )}
                  {serverSince && (
                    <p>
                      {serverSince} <span className="text-gray-500">· neste servidor</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {voiceChannel && (
              <div>
                <SectionTitle>Em call</SectionTitle>
                <p className="flex items-center gap-1.5 text-xs text-gray-200">
                  <VolumeIcon className="h-3.5 w-3.5 text-[#23a55a]" />
                  {voiceChannel.name}
                </p>
              </div>
            )}
          </div>
        )}

        {isMe ? (
          <>
            <div className="mt-3 rounded-lg bg-black/30 p-1.5">
              <MenuButton
                icon={<PencilIcon className="h-4 w-4" />}
                label="Editar perfil"
                onClick={editProfile}
              />
              <div className="mx-2 my-1 h-px bg-white/10" />
              <StatusMenu status={status} />
            </div>
            <div className="mt-2 rounded-lg bg-black/30 p-1.5">
              <MenuButton
                icon={
                  <span className="rounded-[3px] border border-current px-0.5 text-[8px] font-black leading-tight">
                    ID
                  </span>
                }
                label="Copiar ID do usuário"
                onClick={() => void copyId()}
              />
            </div>
          </>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={sendMessage}
              className="flex-1 cursor-pointer rounded-lg bg-[#5865f2] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4752c4]"
            >
              Enviar mensagem
            </button>
            {!isFriend && card.username && (
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
      </ProfileCardBody>
    </div>
  )
}

export default UserProfileCard
