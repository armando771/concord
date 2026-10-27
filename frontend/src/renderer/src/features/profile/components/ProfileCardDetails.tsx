import { MAESTRO_HOWTO, MAESTRO_USER_ID } from '../../music/lib/music'
import { detectProvider, linkLabel, splitLinks } from '../lib/profileLinks'
import LinkIcon from './LinkIcon'
import StyledName from './StyledName'
import { ProfileBioSkeleton } from '../../../shared/ui/skeleton/layouts'
import type { CardProfile, ProfileCardBodyProps } from './ProfileCardBody'

// Corpo do cartão de perfil abaixo do avatar: nomes, Sobre mim, o passo a passo
// do Maestro e os links.

/** @usuário, pronomes, selo BOT e a fileira de badges. */
function ProfileHandleRow({
  profile,
  badges
}: Pick<ProfileCardBodyProps, 'profile' | 'badges'>): React.JSX.Element | null {
  if (!profile.username && !profile.pronouns && !badges) return null
  return (
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
  )
}

export function ProfileNames({
  profile,
  isMe,
  preview,
  badges
}: Pick<ProfileCardBodyProps, 'profile' | 'badges'> & {
  isMe: boolean
  preview: boolean
}): React.JSX.Element {
  return (
    <div className="mt-2">
      <p className="truncate text-xl font-bold text-strong">
        {profile.nickname ? (
          profile.nickname
        ) : (
          <StyledName
            name={profile.display_name || ' '}
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
      <ProfileHandleRow profile={profile} badges={badges} />
    </div>
  )
}

export function ProfileBio({
  bio,
  loading
}: {
  bio: string | undefined
  loading: boolean
}): React.JSX.Element | null {
  if (loading && !bio) return <ProfileBioSkeleton />
  if (!bio) return null
  return (
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
  )
}

export function MaestroHowto({ profile }: { profile: CardProfile }): React.JSX.Element | null {
  if (!profile.is_bot || profile.id !== MAESTRO_USER_ID) return null
  return (
    <div className="mt-3 rounded-lg bg-fg/5 p-2.5">
      <p className="text-ds-xs font-bold uppercase text-gray-400">{MAESTRO_HOWTO.title}</p>
      <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm leading-snug text-gray-200">
        {MAESTRO_HOWTO.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  )
}

export function ProfileLinks({ links }: { links: string[] | undefined }): React.JSX.Element | null {
  if (!links?.length) return null
  return (
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
  )
}
