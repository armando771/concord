import GameIcon from '../../../activity/components/GameIcon'
import { Elapsed } from '../../../activity/components/ActivityCard'
import type { PresenceActivity } from '../../../activity/lib/presenceActivity'
import { MAESTRO_HOWTO } from '../../../music/lib/music'
import { detectProvider, linkLabel, splitLinks } from '../../lib/profileLinks'
import LinkIcon from '../LinkIcon'

// As seções de baixo do cartão: jogo, Sobre mim, o passo a passo do Maestro
// e os links.

export function CardGame({ game }: { game: PresenceActivity | null }): React.JSX.Element | null {
  if (!game) return null
  return (
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
  )
}

/** Sobre mim, com os links do texto clicáveis. */
export function CardBio({ bio }: { bio?: string }): React.JSX.Element | null {
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

export function MaestroHowto(): React.JSX.Element {
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

/** Os links do perfil (Steam, Twitch...), um ícone por serviço. */
export function CardLinks({ links }: { links: string[] }): React.JSX.Element | null {
  if (links.length === 0) return null
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
