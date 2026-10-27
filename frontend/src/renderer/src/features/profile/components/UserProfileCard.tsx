import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import router from '../../../app/router'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../../call/store/callStore'
import { useActivityStore } from '../../activity/store/activityStore'
import { activityOfPlayer, canJoinFromProfile } from '../../activity/lib/activityState'
import { useChatStore } from '../../chat/store/chatStore'
import { useFriendStore, useRelationship } from '../../friends/store/friendStore'
import { useUserMenuStore } from '../store/userMenuStore'
import { getRelationship, type Relationship } from '../../friends/api/friends'
import { friendRequestError } from '../lib/relationship'
import { useLevelStore } from '../../levels/store/levelStore'
import { useBadgeStore } from '../../levels/store/badgeStore'
import { useProfileCardStore } from '../store/profileCardStore'
import { useProfileStore } from '../store/profileStore'
import { useServerStore } from '../../servers/store/serverStore'
import { useSettingsStore } from '../../settings/store/settingsStore'
import { changeMyStatus } from '../store/meActions'
import { showToast } from '../../../shared/store/toastStore'
import { formatMemberSince, placeProfileCard } from '../lib/profileCard'
import { serverIdFromPath } from '../../servers/lib/serverNames'
import { useServerAccess } from '../../servers/hooks/useServerAccess'
import { useModerationStore } from '../../call/store/moderationStore'
import { levelTier } from '../../levels/lib/levels'
import { voiceChannelOf } from '../../call/lib/voiceMove'
import { memberColor } from '../../servers/lib/memberGroups'
import { Perm, roleColorCss, rolesOfMember } from '../../servers/lib/permissions'
import { isUserLive, liveTarget, type MyCall } from '../../call/lib/screenPreview'
import { requestWatchStream } from '../../call/store/streamJoinStore'
import { CHOSEN_STATUSES, STATUS_META, type PresenceStatus } from '../../friends/lib/presenceStatus'
import LevelBadge from '../../levels/components/LevelBadge'
import BadgeRow from '../../levels/components/BadgeRow'
import ProfileCardBody, { CARD_BG, type CardProfile } from './ProfileCardBody'
import { ProfileInfoSkeleton } from '../../../shared/ui/skeleton/layouts'
import ProfileCardFrame from './ProfileCardFrame'
import ProfileRoleChips, { TierName } from './ProfileRoleChips'
import { profileThemeLook, resolveProfileTheme } from '../lib/profileTheme'
import LiveStreamPreview from './LiveStreamPreview'
import LiveBadge from '../../call/components/LiveBadge'
import StatusIcon from '../../../shared/ui/StatusIcon'
import { DotsIcon, PencilIcon, VolumeIcon } from '../../../shared/ui/icons'
import Avatar from '../../../shared/ui/Avatar'
import { useThemeStore } from '../../settings/store/themeStore'
import { ActivityGlyph } from '../../call/components/ActivityPickerPopover'

const CARD_WIDTH = 300
/** Altura aproximada do submenu de status (4 opções, duas com descrição). */
const STATUS_MENU_HEIGHT = 230

const OWNER_STYLE = { label: 'Dono do servidor', color: '#f59e0b', avatar: 'bg-amber-600' } as const
/** Cor de quem não tem cargo colorido. */
const NO_ROLE_COLOR = '#6366f1'

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
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm font-medium text-gray-200 transition-colors hover:bg-fg/10 hover:text-strong"
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
  // O submenu tem o fundo do app: volta ao tema de cor mesmo num cartão com fundo próprio.
  const appTheme = useThemeStore((s) => s.theme)
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
            data-theme={appTheme}
            className="pt-ink-keep w-64 rounded-lg border border-subtle p-1.5 shadow-2xl"
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
                className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-fg/10"
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
  const serverRoles = useServerStore((s) => s.roles)
  const channels = useServerStore((s) => s.channels)
  const online = useChatStore((s) => (target ? Boolean(s.presence[target.userId]) : false))
  const knownStatus = useChatStore((s) => (target ? s.statuses[target.userId] : undefined))
  const serverCalls = useCallStore((s) => s.serverCalls)
  const callStatus = useCallStore((s) => s.status)
  const callId = useCallStore((s) => s.callId)
  const callType = useCallStore((s) => s.type)
  const callChannelId = useCallStore((s) => s.channelId)
  const screenSharers = useCallStore((s) => s.screenSharers)
  const availableScreens = useCallStore((s) => s.availableScreens)
  const level = useLevelStore((s) => (target ? s.levels[target.userId] : undefined))
  const ensureLevels = useLevelStore((s) => s.ensureLevels)
  const replayLevelUp = useLevelStore((s) => s.replayLevelUp)
  const relationship = useRelationship(target?.userId)
  const sendRequest = useFriendStore((s) => s.sendRequest)
  const accept = useFriendStore((s) => s.accept)
  const profile = useProfileStore((s) => (target ? s.profiles[target.userId] : undefined))
  const fetchProfile = useProfileStore((s) => s.fetchProfile)
  const openSettings = useSettingsStore((s) => s.openSettings)
  const access = useServerAccess()
  const askNickname = useModerationStore((s) => s.askNickname)
  // Os badges chegam depois e podem mudar a altura do cartão.
  const badgesLoaded = useBadgeStore((s) => (target ? Boolean(s.byUser[target.userId]) : false))
  // Atividade da chamada em que a pessoa está jogando (só se for a minha call).
  const joinableActivity = useActivityStore((s) =>
    target && canJoinFromProfile(s, me?.id ?? null, target.userId)
      ? activityOfPlayer(s, target.userId)
      : null
  )
  const joinActivity = useActivityStore((s) => s.join)
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [sending, setSending] = useState(false)
  // Amigos e servidores em comum (só no cartão de outra pessoa).
  const [loadedMutual, setMutual] = useState<{ userId: string; rel: Relationship } | null>(null)
  const mutual = loadedMutual && loadedMutual.userId === target?.userId ? loadedMutual.rel : null
  // Quem já respondeu (mesmo com erro): o skeleton não fica para sempre se a chamada falhar.
  const [profileSettled, setProfileSettled] = useState<string | null>(null)
  const [mutualSettled, setMutualSettled] = useState<string | null>(null)

  const isMe = Boolean(target && target.userId === me?.id)
  const isBot = Boolean(profile?.is_bot || member?.is_bot)

  // Transmitindo agora: selo LIVE e, se dá para assistir, a prévia com o botão.
  const myCall: MyCall = {
    status: callStatus,
    callId,
    type: callType,
    channelId: callChannelId,
    screenSharers,
    availableScreens
  }
  const live = target ? isUserLive(target.userId, myCall, serverCalls) : false
  const stream = target
    ? liveTarget({
        userId: target.userId,
        meId: me?.id,
        call: myCall,
        serverCalls,
        canConnect: (channelId) => access.canInChannel(channelId, Perm.VIEW_CHANNEL | Perm.CONNECT)
      })
    : null
  const streamKey = stream ? `${stream.kind}:${stream.callId}` : ''

  useEffect(() => {
    if (!target) return
    ensureLevels([target.userId])
    if (target.userId === useAuthStore.getState().user?.id) return
    let cancelled = false
    void fetchProfile(target.userId).finally(() => {
      if (!cancelled) setProfileSettled(target.userId)
    })
    return () => {
      cancelled = true
    }
  }, [target, ensureLevels, fetchProfile])

  useEffect(() => {
    if (!target || target.userId === useAuthStore.getState().user?.id) return
    let cancelled = false
    getRelationship(target.userId)
      .then((r) => {
        if (!cancelled) setMutual({ userId: target.userId, rel: r })
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setMutualSettled(target.userId)
      })
    return () => {
      cancelled = true
    }
  }, [target, relationship])

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
  }, [
    target,
    profile,
    me,
    mutual,
    badgesLoaded,
    profileSettled,
    mutualSettled,
    streamKey,
    live,
    joinableActivity
  ])

  useEffect(() => {
    if (!target) return
    const onDown = (e: MouseEvent): void => {
      const node = e.target as Node
      // No item que abriu o cartão, no próprio cartão ou nas configs abertas dele, o clique não fecha o cartão.
      if (
        ref.current?.contains(node) ||
        target.anchorEl?.contains(node) ||
        (node instanceof Element && node.closest('[data-user-context-menu]'))
      ) {
        return
      }
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

  useEffect(() => {
    return () => {
      const menu = useUserMenuStore.getState().target
      if (menu && menu.userId === target?.userId && menu.anchorEl) {
        useUserMenuStore.getState().close()
      }
    }
  }, [target?.userId])

  if (!target) return null

  const inServer = Boolean(server && member)
  // O apelido só vale com o servidor aberto na tela (em DM não existe).
  const nicknameContext =
    inServer && serverIdFromPath(router.state.location.pathname) === server?.id
  const nickname = nicknameContext ? (member?.nickname ?? null) : null
  const canNickname = nicknameContext && access.canChangeNickname(target.userId)
  const isServerOwner = server?.owner_id === target.userId
  const memberRoles = inServer ? rolesOfMember(serverRoles, member?.role_ids) : []
  // O banner e o avatar sem foto usam a cor do cargo mais alto que tem cor.
  const role = {
    color: isServerOwner
      ? OWNER_STYLE.color
      : (roleColorCss(memberColor(serverRoles, member?.role_ids)) ?? NO_ROLE_COLOR),
    avatar: isServerOwner ? OWNER_STYLE.avatar : 'bg-indigo-600'
  }
  const tier = level !== undefined ? levelTier(level) : null

  const source = isMe ? me : profile
  const card: CardProfile = {
    id: target.userId,
    display_name: source?.display_name || member?.display_name || target.name,
    name_style: source?.name_style ?? member?.name_style,
    nickname,
    username: source?.username || member?.username || target.username,
    avatar_url: source ? source.avatar_url : member?.avatar_url,
    banner_url: source?.banner_url,
    banner_color: source?.banner_color,
    pronouns: source?.pronouns,
    bio: source?.bio,
    status_text: source?.status_text,
    links: source?.links?.map((l) => l.url) ?? [],
    is_bot: isBot,
    profile_theme: source?.profile_theme
  }
  const theme = resolveProfileTheme(card.profile_theme)
  const look = profileThemeLook(theme)
  // O Maestro não tem websocket: está sempre online.
  const status: PresenceStatus = isBot
    ? 'online'
    : isMe
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

  const editNickname = (): void => {
    if (!server) return
    close()
    askNickname({
      serverId: server.id,
      userId: target.userId,
      name: nickname || card.display_name,
      nickname,
      displayName: card.display_name,
      self: isMe
    })
  }
  const nicknameButton = canNickname && (
    <MenuButton
      icon={<span className="text-ds-sm font-black leading-none">@</span>}
      label="Alterar apelido"
      onClick={editNickname}
    />
  )

  const sendMessage = (): void => {
    close()
    void router.navigate(`/dm/${target.userId}`)
  }

  const addFriend = async (): Promise<void> => {
    if (!card.username) return
    setSending(true)
    try {
      if (relationship === 'incoming') {
        await accept(card.username)
      } else {
        const result = await sendRequest(card.username)
        showToast.success(
          result === 'accepted'
            ? `Você e ${card.display_name} agora são amigos.`
            : `Pedido de amizade enviado para ${card.display_name}.`
        )
      }
    } catch (err) {
      showToast.error(friendRequestError(err))
    } finally {
      setSending(false)
    }
  }

  // Primeira carga de cada parte: o cartão abre na hora com o que já se sabe.
  const profileLoading = !isMe && !profile && profileSettled !== target.userId
  const mutualLoading = !isMe && !mutual && mutualSettled !== target.userId
  const mutualFriends = mutual?.mutual_friends ?? []
  const mutualServers = mutual?.mutual_servers ?? []
  const hasInfo =
    inServer ||
    tier ||
    salinhaSince ||
    voiceChannel ||
    mutualFriends.length > 0 ||
    mutualServers.length > 0 ||
    mutualLoading

  const watchStream = (): void => {
    if (!stream) return
    close()
    requestWatchStream({
      userId: target.userId,
      name: nickname || card.display_name,
      target: stream,
      channelName:
        stream.kind === 'join' ? channels.find((c) => c.id === stream.channelId)?.name : undefined
    })
  }

  const openMore = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const currentMenu = useUserMenuStore.getState().target
    if (currentMenu && currentMenu.userId === target.userId) {
      useUserMenuStore.getState().close()
      return
    }
    const r = e.currentTarget.getBoundingClientRect()
    useUserMenuStore.getState().open({
      userId: target.userId,
      name: nickname || card.display_name,
      username: card.username,
      x: r.left,
      y: r.bottom + 4,
      anchorEl: e.currentTarget
    })
  }

  return (
    <ProfileCardFrame
      ref={ref}
      look={look}
      effect={theme.effect}
      role="dialog"
      aria-label={`Perfil de ${nickname || card.display_name}`}
      style={{
        width: CARD_WIDTH,
        left: pos?.left ?? -9999,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        // O tema troca o padding-box; "fixed" ganha do relative da moldura.
        position: 'fixed'
      }}
      className="z-[60] text-sm text-gray-200 shadow-2xl"
    >
      <ProfileCardBody
        profile={card}
        surface={look.surface}
        status={status}
        isMe={isMe}
        fallbackBanner={fallbackBanner}
        avatarFallbackClassName={role.avatar}
        badge={
          <LevelBadge
            userId={target.userId}
            size="md"
            onClick={() => replayLevelUp(target.userId, card.display_name)}
          />
        }
        badges={
          <BadgeRow
            userId={target.userId}
            name={card.display_name}
            avatarUrl={card.avatar_url}
            onOpen={close}
          />
        }
        onEditProfile={isMe ? editProfile : undefined}
        loading={profileLoading}
      >
        {stream && (
          <LiveStreamPreview
            key={`${stream.callId}:${target.userId}`}
            userId={target.userId}
            name={nickname || card.display_name}
            target={stream}
            onWatch={watchStream}
          />
        )}

        {joinableActivity && (
          <button
            type="button"
            onClick={() => {
              close()
              void joinActivity()
            }}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-success-strong px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-success-strong-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ActivityGlyph activity={joinableActivity} className="h-4 w-4" />
            Juntar-se à atividade
            <span className="sr-only">: {joinableActivity.name}</span>
          </button>
        )}
        {hasInfo && (
          <div className="mt-3 flex flex-col gap-3 rounded-lg bg-input p-3">
            {inServer && (isServerOwner || memberRoles.length > 0) && (
              <div>
                <SectionTitle>{memberRoles.length > 1 ? 'Cargos' : 'Cargo'}</SectionTitle>
                <ProfileRoleChips
                  roles={memberRoles}
                  owner={isServerOwner ? OWNER_STYLE : undefined}
                  background={theme.background_colors}
                  ink={look.ink}
                />
              </div>
            )}

            {tier && (
              <div>
                <SectionTitle>Nível de voz</SectionTitle>
                <p className="text-xs text-gray-200">
                  Nível {level} ·{' '}
                  <TierName
                    name={tier.name}
                    color={tier.color}
                    background={theme.background_colors}
                    ink={look.ink}
                  />
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

            {mutualServers.length > 0 && (
              <div>
                <SectionTitle>
                  {mutualServers.length === 1
                    ? '1 servidor em comum'
                    : `${mutualServers.length} servidores em comum`}
                </SectionTitle>
                <p className="truncate text-xs text-gray-200">
                  {mutualServers.map((sv) => sv.name).join(', ')}
                </p>
              </div>
            )}

            {mutualFriends.length > 0 && (
              <div>
                <SectionTitle>
                  {mutualFriends.length === 1
                    ? '1 amigo em comum'
                    : `${mutualFriends.length} amigos em comum`}
                </SectionTitle>
                <div className="flex items-center gap-1.5">
                  {mutualFriends.slice(0, 6).map((f) => (
                    <span key={f.id} title={f.display_name || f.username}>
                      <Avatar
                        userId={f.id}
                        name={f.display_name || f.username}
                        avatarUrl={f.avatar_url}
                        size={20}
                      />
                    </span>
                  ))}
                </div>
              </div>
            )}

            {voiceChannel && (
              <div>
                <SectionTitle>Em call</SectionTitle>
                <p className="flex items-center gap-1.5 text-xs text-gray-200">
                  <VolumeIcon className="h-3.5 w-3.5 text-success" />
                  <span className="min-w-0 truncate">{voiceChannel.name}</span>
                  {live && <LiveBadge />}
                </p>
              </div>
            )}

            {/* Amigos e servidores em comum vêm de outra chamada. */}
            {mutualLoading && <ProfileInfoSkeleton sections={2} />}
          </div>
        )}

        {isMe ? (
          <>
            <div className="mt-3 rounded-lg bg-input p-1.5">
              <MenuButton
                icon={<PencilIcon className="h-4 w-4" />}
                label="Editar perfil"
                onClick={editProfile}
              />
              {nicknameButton}
              <div className="mx-2 my-1 h-px bg-fg/10" />
              <StatusMenu status={status} />
            </div>
          </>
        ) : isBot ? null : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={sendMessage}
              className="flex-1 cursor-pointer rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Enviar mensagem
            </button>
            {card.username && relationship !== 'friend' && relationship !== 'blocked' && (
              <button
                type="button"
                disabled={sending || relationship === 'outgoing'}
                onClick={() => void addFriend()}
                className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-default disabled:opacity-60 ${
                  relationship === 'incoming'
                    ? 'bg-success-strong text-white hover:bg-success-strong-hover'
                    : 'bg-fg/10 text-strong hover:bg-fg/15'
                }`}
              >
                {relationship === 'outgoing'
                  ? 'Pedido enviado'
                  : relationship === 'incoming'
                    ? 'Aceitar pedido'
                    : 'Adicionar amigo'}
              </button>
            )}
            <button
              type="button"
              aria-label="Mais"
              title="Mais"
              onClick={openMore}
              className="flex cursor-pointer items-center justify-center rounded-lg bg-fg/10 px-2.5 text-gray-200 transition-colors hover:bg-fg/15"
            >
              <DotsIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        {!isMe && nicknameButton && (
          <div className="mt-2 rounded-lg bg-input p-1.5">{nicknameButton}</div>
        )}
      </ProfileCardBody>
    </ProfileCardFrame>
  )
}

export default UserProfileCard
