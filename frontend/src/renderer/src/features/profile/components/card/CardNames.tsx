import type { ReactNode } from 'react'
import StyledName from '../StyledName'
import type { CardProfile } from '../ProfileCardBody'

/** O nome em destaque: o apelido do servidor ou o nome de exibição estilizado. */
function NameLine({
  profile,
  you
}: {
  profile: CardProfile
  you: boolean
}): React.JSX.Element {
  return (
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
      {you && <span className="ml-1.5 text-xs font-medium text-gray-400">(você)</span>}
    </p>
  )
}

/** "usuario • pronomes", o selo BOT e as badges. */
function SubLine({
  profile,
  badges
}: {
  profile: CardProfile
  badges?: ReactNode
}): React.JSX.Element | null {
  const { username, pronouns } = profile
  if (!username && !pronouns && !badges) return null
  return (
    <div className="flex min-w-0 items-center gap-2">
      <p className="min-w-0 truncate text-sm text-gray-300">
        {username && <span>{username}</span>}
        {username && pronouns && <span className="text-gray-500"> • </span>}
        {pronouns && <span className="text-gray-400">{pronouns}</span>}
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

/** Nome, nome de verdade (quando há apelido) e a linha do @. */
export default function CardNames({
  profile,
  you,
  badges
}: {
  profile: CardProfile
  /** Mostra "(você)" ao lado do nome. */
  you: boolean
  badges?: ReactNode
}): React.JSX.Element {
  return (
    <div className="mt-2">
      <NameLine profile={profile} you={you} />
      {profile.nickname && (
        <p
          className="truncate text-ds-sm font-semibold text-gray-200"
          title="Nome de exibição (fora deste servidor)"
        >
          <StyledName name={profile.display_name} userId={profile.id} style={profile.name_style} />
        </p>
      )}
      <SubLine profile={profile} badges={badges} />
    </div>
  )
}
