import { API_BASE_URL } from '../../../shared/lib/config'
import { MAESTRO_USER_ID } from '../../music/lib/music'
import { profileMediaSrc } from '../lib/profileMedia'
import Avatar from '../../../shared/ui/Avatar'
import maestroBanner from '../../../assets/maestro-banner.gif'
import { PencilIcon, PlusIcon } from '../../../shared/ui/icons'
import { Skeleton } from '../../../shared/ui/skeleton/Skeleton'
import type { CardProfile, ProfileCardBodyProps } from './ProfileCardBody'

// Topo do cartão de perfil: banner, avatar e o balão da nota.

/** O banner animado é do Maestro; o Salinha Bot fica com o gradiente padrão. */
function bannerSource(profile: CardProfile): string | null {
  const own = profileMediaSrc(profile.banner_url, API_BASE_URL)
  if (own) return own
  return profile.is_bot && profile.id === MAESTRO_USER_ID ? maestroBanner : null
}

/** Sem imagem: a cor escolhida ou o gradiente padrão. */
function bannerBackground(
  profile: CardProfile,
  bannerSrc: string | null,
  fallbackBanner: string
): React.CSSProperties | undefined {
  if (bannerSrc) return undefined
  return profile.banner_color ? { background: profile.banner_color } : { backgroundImage: fallbackBanner }
}

/** Banner: imagem/GIF, cor escolhida ou o gradiente padrão. */
export function ProfileBanner({
  profile,
  fallbackBanner,
  loading,
  surface,
  onEditBanner
}: Pick<ProfileCardBodyProps, 'profile' | 'fallbackBanner' | 'onEditBanner'> & {
  loading: boolean
  surface: string
}): React.JSX.Element {
  const bannerSrc = bannerSource(profile)
  return (
    <div
      className={`group/banner relative overflow-hidden rounded-t-[10px] ${bannerSrc ? 'h-[106px]' : 'h-16'}`}
      style={bannerBackground(profile, bannerSrc, fallbackBanner)}
    >
      {bannerSrc && (
        <img src={bannerSrc} alt="" draggable={false} className="h-full w-full object-cover" />
      )}
      {loading && !bannerSrc && !profile.banner_color && (
        // Opaco: o degradê de cargo por baixo ainda não vale (o perfil pode ter banner).
        <div className="h-full w-full" style={{ background: surface }}>
          <Skeleton className="h-full w-full rounded-none" />
        </div>
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
  )
}

export function ProfileAvatar({
  profile,
  status,
  preview,
  surface,
  avatarFallbackClassName,
  onEditProfile,
  onEditAvatar
}: Pick<
  ProfileCardBodyProps,
  'profile' | 'status' | 'avatarFallbackClassName' | 'onEditProfile' | 'onEditAvatar'
> & { preview: boolean; surface: string }): React.JSX.Element {
  return (
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
  )
}

/** Nota: o balão ao lado da foto, como no Discord. Sem nota, só "Adicionar" no próprio perfil. */
export function ProfileNote({
  note,
  isMe,
  onEditProfile
}: {
  note: string | undefined
  isMe: boolean
  onEditProfile?: () => void
}): React.JSX.Element | null {
  if (!note && !(isMe && onEditProfile)) return null
  return (
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
  )
}
