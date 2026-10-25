import type { ReactNode } from 'react'
import { API_BASE_URL } from '../../lib/config'
import { profileMediaSrc } from '../../lib/profileMedia'
import { detectProvider, linkLabel, splitLinks } from '../../lib/profileLinks'
import type { PresenceStatus } from '../../lib/presenceStatus'
import Avatar from '../Avatar'
import { PencilIcon, PlusIcon } from '../icons'
import LinkIcon from './LinkIcon'

/** Fundo do cartão: recorta o avatar e a bolinha de status. */
export const CARD_BG = '#111214'

export interface CardProfile {
  id?: string
  display_name: string
  username?: string
  avatar_url?: string | null
  banner_url?: string | null
  banner_color?: string | null
  pronouns?: string
  bio?: string
  status_text?: string
  links?: string[]
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
  children
}: ProfileCardBodyProps): React.JSX.Element {
  const bannerSrc = profileMediaSrc(profile.banner_url, API_BASE_URL)
  const note = profile.status_text?.trim()
  const bio = profile.bio?.trim()
  const links = profile.links ?? []

  return (
    <div>
      {/* Banner: imagem/GIF, cor escolhida ou o gradiente padrão. */}
      <div
        className={`overflow-hidden rounded-t-xl ${bannerSrc ? 'h-[106px]' : 'h-16'}`}
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
      </div>

      <div className="px-4 pb-4">
        <div className="relative -mt-[46px] flex items-start justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <div className="relative shrink-0 rounded-full p-1.5" style={{ background: CARD_BG }}>
              <Avatar
                userId={preview ? undefined : profile.id}
                name={profile.display_name}
                avatarUrl={profile.avatar_url}
                size={80}
                animate="always"
                status={status}
                cutoutColor={CARD_BG}
                fallbackClassName={avatarFallbackClassName}
              />
              {onEditProfile && (
                <button
                  type="button"
                  onClick={onEditProfile}
                  aria-label="Editar perfil"
                  className="absolute inset-1.5 flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full bg-black/60 text-[10px] font-bold uppercase text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                >
                  <PencilIcon className="h-4 w-4" />
                  Editar perfil
                </button>
              )}
            </div>

            {/* Nota: o balão ao lado da foto, como no Discord. */}
            {(note || (isMe && onEditProfile)) && (
              <div className="relative mt-[38px] min-w-0">
                <span
                  aria-hidden="true"
                  className="absolute -left-2.5 top-1 h-3 w-3 rounded-full border border-white/10 bg-[#232428]"
                />
                <span
                  aria-hidden="true"
                  className="absolute -left-4 -top-0.5 h-1.5 w-1.5 rounded-full border border-white/10 bg-[#232428]"
                />
                {note ? (
                  <p className="relative max-w-[170px] break-words rounded-2xl border border-white/10 bg-[#232428] px-3 py-2 text-xs leading-snug text-gray-200 shadow-lg">
                    {note}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={onEditProfile}
                    className="relative flex max-w-[170px] cursor-pointer items-center gap-1.5 rounded-2xl border border-white/10 bg-[#232428] px-3 py-2 text-left text-xs italic text-gray-400 shadow-lg transition-colors hover:text-gray-200"
                  >
                    <PlusIcon className="h-3.5 w-3.5 shrink-0 rounded-full bg-gray-400 p-0.5 text-[#232428]" />
                    Adicionar uma nota
                  </button>
                )}
              </div>
            )}
          </div>
          {badge && <div className="mt-[52px] shrink-0">{badge}</div>}
        </div>

        <div className="mt-2">
          <p className="truncate text-xl font-bold text-white">
            {profile.display_name || ' '}
            {isMe && !preview && (
              <span className="ml-1.5 text-xs font-medium text-gray-400">(você)</span>
            )}
          </p>
          {(profile.username || profile.pronouns || badges) && (
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 truncate text-sm text-gray-300">
                {profile.username && <span>{profile.username}</span>}
                {profile.username && profile.pronouns && <span className="text-gray-500"> • </span>}
                {profile.pronouns && <span className="text-gray-400">{profile.pronouns}</span>}
              </p>
              {badges}
            </div>
          )}
        </div>

        {bio && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-snug text-gray-200">
            {splitLinks(bio).map((part, i) =>
              part.url ? (
                <a
                  key={i}
                  href={part.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#00a8fc] hover:underline"
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
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
