import type { ReactNode } from 'react'
import { API_BASE_URL } from '../../lib/config'
import { MAESTRO_USER_ID } from '../../lib/music'
import { profileMediaSrc } from '../../lib/profileMedia'
import { detectProvider, linkLabel, splitLinks } from '../../lib/profileLinks'
import type { PresenceStatus } from '../../lib/presenceStatus'
import Avatar from '../Avatar'
import maestroBanner from '../../assets/maestro-banner.gif'
import { PencilIcon, PlusIcon } from '../icons'
import GameIcon from '../GameIcon'
import { Elapsed } from '../ActivityCard'
import { useActivity } from '../../store/presenceActivityStore'
import LinkIcon from './LinkIcon'
import StyledName from '../StyledName'
import type { NameStyle } from '../../lib/nameStyle'
import { CARD_BG, type ProfileTheme } from '../../lib/profileTheme'

/** Fundo do cartão sem tema: recorta o avatar e a bolinha de status. */
export { CARD_BG }

export interface CardProfile {
  id?: string
  display_name: string
  name_style?: NameStyle
  /** Apelido no servidor aberto: aparece em destaque, com o nome de verdade embaixo. */
  nickname?: string | null
  username?: string
  avatar_url?: string | null
  banner_url?: string | null
  banner_color?: string | null
  pronouns?: string
  bio?: string
  status_text?: string
  links?: string[]
  /** Bot (Maestro, Salinha Bot): selo BOT; o Maestro tem banner animado próprio. */
  is_bot?: boolean
  /** Borda, fundo e efeito do cartão (quem desenha é o ProfileCardFrame). */
  profile_theme?: ProfileTheme
}

interface ProfileCardBodyProps {
  profile: CardProfile
  status?: PresenceStatus | null
  isMe?: boolean
  /** Banner sem imagem nem cor escolhida (o gradiente de cargo/nível). */
  fallbackBanner: string
  avatarFallbackClassName?: string
  /** Canto direito, na altura do avatar (selo de nível). */
  badge?: ReactNode
  /** Fileira de badges ao lado do username. */
  badges?: ReactNode
  /** Só no próprio perfil: avatar e nota vazia levam ao editor. */
  onEditProfile?: () => void
  /** Prévia do editor: o avatar não usa o profileStore (mostra o rascunho). */
  preview?: boolean
  /** Cor do fundo logo abaixo do banner (tema): anel do avatar e recorte do status. */
  surface?: string
  /** Prévia do editor: passar o mouse mostra o lápis e o clique já abre o arquivo. */
  onEditAvatar?: () => void
  onEditBanner?: () => void
  children?: ReactNode
}

/**
 * Corpo do cartão de perfil (banner, avatar, nota, nome, Sobre mim e links),
 * igual no cartão que abre ao clicar e na prévia do editor de perfil.
 */
function ProfileCardBody({
  profile,
  status,
  isMe = false,
  fallbackBanner,
  avatarFallbackClassName,
  badge,
  badges,
  onEditProfile,
  preview = false,
  surface = CARD_BG,
  onEditAvatar,
  onEditBanner,
  children
}: ProfileCardBodyProps): React.JSX.Element {
  // O banner animado é do Maestro; o Salinha Bot fica com o gradiente padrão.
  const bannerSrc =
    profileMediaSrc(profile.banner_url, API_BASE_URL) ??
    (profile.is_bot && profile.id === MAESTRO_USER_ID ? maestroBanner : null)
  const note = profile.status_text?.trim()
  const bio = profile.bio?.trim()
  const game = useActivity(preview ? undefined : profile.id)
  const links = profile.links ?? []

  return (
    <div>
      {/* Banner: imagem/GIF, cor escolhida ou o gradiente padrão. */}
      <div
        className={`group/banner relative overflow-hidden rounded-t-[10px] ${bannerSrc ? 'h-[106px]' : 'h-16'}`}
        style={
          bannerSrc
            ? undefined
            : profile.banner_color
              ? { background: profile.banner_color }
              : { backgroundImage: fallbackBanner }
        }
      >
        {bannerSrc && (
          <img src={bannerSrc} alt="" draggable={false} className="h-full w-full object-cover" />
        )}
        {onEditBanner && (
          <button
            type="button"
            onClick={onEditBanner}
            aria-label="Alterar banner"
            title="Alterar banner"
            className="group/edit absolute inset-0 cursor-pointer outline-none"
          >
            <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 shadow-lg ring-white/70 transition-opacity group-hover/banner:opacity-100 group-focus-visible/edit:opacity-100 group-focus-visible/edit:ring-2">
              <PencilIcon className="h-4 w-4" />
            </span>
          </button>
        )}
      </div>

      <div className="px-4 pb-4">
        {/* A faixa que sobe por cima do banner não pega o mouse (o lápis do banner
            aparece nela também); só o avatar, a nota e o selo pegam. */}
        <div className="pointer-events-none relative -mt-[46px] flex items-start justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <div
              className="pt-ink-keep pointer-events-auto relative shrink-0 rounded-full p-1.5"
              style={{ background: surface }}
            >
              <Avatar
                userId={preview ? undefined : profile.id}
                name={profile.nickname || profile.display_name}
                avatarUrl={profile.avatar_url}
                size={80}
                animate="always"
                status={status}
                cutoutColor={surface}
                fallbackClassName={avatarFallbackClassName}
              />
              {onEditProfile && (
                <button
                  type="button"
                  onClick={onEditProfile}
                  aria-label="Editar perfil"
                  className="absolute inset-1.5 flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full bg-black/60 text-[10px] font-bold uppercase text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 on-media"
                >
                  <PencilIcon className="h-4 w-4" />
                  Editar perfil
                </button>
              )}
              {onEditAvatar && (
                <button
                  type="button"
                  onClick={onEditAvatar}
                  aria-label="Alterar avatar"
                  title="Alterar avatar"
                  className="absolute inset-1.5 flex cursor-pointer items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                >
                  <PencilIcon className="h-5 w-5 drop-shadow" />
                </button>
              )}
            </div>

            {/* Nota: o balão ao lado da foto, como no Discord. */}
            {(note || (isMe && onEditProfile)) && (
              <div className="pointer-events-auto relative mt-[38px] min-w-0">
                <span
                  aria-hidden="true"
                  className="absolute -left-2.5 top-1 h-3 w-3 rounded-full border border-subtle bg-primary"
                />
                <span
                  aria-hidden="true"
                  className="absolute -left-4 -top-0.5 h-1.5 w-1.5 rounded-full border border-subtle bg-primary"
                />
                {note ? (
                  <p className="relative max-w-[170px] break-words rounded-2xl border border-subtle bg-primary px-3 py-2 text-xs leading-snug text-gray-200 shadow-lg">
                    {note}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={onEditProfile}
                    className="relative flex max-w-[170px] cursor-pointer items-center gap-1.5 rounded-2xl border border-subtle bg-primary px-3 py-2 text-left text-xs italic text-gray-400 shadow-lg transition-colors hover:text-gray-200"
                  >
                    <PlusIcon className="h-3.5 w-3.5 shrink-0 rounded-full bg-gray-400 p-0.5 text-[var(--bg-floating)]" />
                    Adicionar uma nota
                  </button>
                )}
              </div>
            )}
          </div>
          {badge && <div className="pointer-events-auto mt-[52px] shrink-0">{badge}</div>}
        </div>

        <div className="mt-2">
          <p className="truncate text-xl font-bold text-strong">
            {profile.nickname ? (
              profile.nickname
            ) : (
              <StyledName
                name={profile.display_name || ' '}
                userId={profile.id}
                style={profile.name_style}
              />
            )}
            {isMe && !preview && (
              <span className="ml-1.5 text-xs font-medium text-gray-400">(você)</span>
            )}
          </p>
          {profile.nickname && (
            <p
              className="truncate text-ds-sm font-semibold text-gray-200"
              title="Nome de exibição (fora deste servidor)"
            >
              <StyledName
                name={profile.display_name}
                userId={profile.id}
                style={profile.name_style}
              />
            </p>
          )}
          {(profile.username || profile.pronouns || badges) && (
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 truncate text-sm text-gray-300">
                {profile.username && <span>{profile.username}</span>}
                {profile.username && profile.pronouns && <span className="text-gray-500"> • </span>}
                {profile.pronouns && <span className="text-gray-400">{profile.pronouns}</span>}
              </p>
              {profile.is_bot && (
                <span className="shrink-0 rounded bg-brand px-1.5 py-px text-[10px] font-bold uppercase leading-tight text-white">
                  Bot
                </span>
              )}
              {badges}
            </div>
          )}
        </div>

        {game && (
          <div className="mt-3 rounded-lg bg-fg/5 p-2.5">
            <p className="text-ds-xs font-bold uppercase text-gray-400">Jogando agora</p>
            <p className="mt-1 flex items-center gap-1.5 text-ds-md font-semibold text-strong">
              <GameIcon
                name={game.name}
                appId={game.app_id}
                iconHash={game.icon_hash}
                className="h-4 w-4 shrink-0"
              />
              <span className="truncate">{game.name}</span>
              <span className="shrink-0 text-ds-xs font-normal text-gray-400">
                <Elapsed startedAt={game.started_at} />
              </span>
            </p>
          </div>
        )}
        {bio && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-snug text-gray-200">
            {splitLinks(bio).map((part, i) =>
              part.url ? (
                <a
                  key={i}
                  href={part.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link hover:underline"
                >
                  {part.text}
                </a>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </p>
        )}

        {links.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {links.map((url) => {
              const provider = detectProvider(url)
              return (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  title={`${provider.label}: ${linkLabel(url)}`}
                  aria-label={`${provider.label}: ${linkLabel(url)}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-subtle bg-fg/5 text-gray-300 transition-colors hover:bg-fg/10 hover:text-strong"
                >
                  <LinkIcon provider={provider.id} />
                </a>
              )
            })}
          </div>
        )}

        {children}
      </div>
    </div>
  )
}

export default ProfileCardBody
