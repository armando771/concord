import { MAESTRO_HOWTO } from '../../../music/lib/music'
import { detectProvider, linkLabel, splitLinks } from '../../lib/profileLinks'
import LinkIcon from '../LinkIcon'

// As seções de baixo do cartão: Sobre mim, o passo a passo do Maestro e os
// links (o jogo e a música ficam em activity/components/ProfileActivities).

/** No editor, o convite no lugar de uma seção vazia. */
function Placeholder({ text }: { text: string }): React.JSX.Element {
  return <p className="mt-3 text-sm italic text-gray-500">{text}</p>
}

/**
 * Sobre mim, com os links do texto clicáveis. No editor (`placeholder`), os
 * links ficam só pintados: o clique abre o modal, não o site.
 */
export function CardBio({
  bio,
  placeholder
}: {
  bio?: string
  placeholder?: string
}): React.JSX.Element | null {
  if (!bio) return placeholder ? <Placeholder text={placeholder} /> : null
  const editing = Boolean(placeholder)
  return (
    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-snug text-gray-200">
      {splitLinks(bio).map((part, i) =>
        part.url && !editing ? (
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
          <span key={i} className={part.url ? 'text-link' : undefined}>
            {part.text}
          </span>
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

const linkClass =
  'flex h-8 w-8 items-center justify-center rounded-lg border border-subtle bg-fg/5 text-gray-300 transition-colors hover:bg-fg/10 hover:text-strong'

/**
 * Os links do perfil (Steam, Twitch...), um ícone por serviço. No editor
 * (`placeholder`), só os ícones: o clique abre o modal.
 */
export function CardLinks({
  links,
  placeholder
}: {
  links: string[]
  placeholder?: string
}): React.JSX.Element | null {
  if (links.length === 0) return placeholder ? <Placeholder text={placeholder} /> : null
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {links.map((url) => {
        const provider = detectProvider(url)
        const label = `${provider.label}: ${linkLabel(url)}`
        if (placeholder) {
          return (
            <span key={url} title={label} className={linkClass}>
              <LinkIcon provider={provider.id} />
            </span>
          )
        }
        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            title={label}
            aria-label={label}
            className={linkClass}
          >
            <LinkIcon provider={provider.id} />
          </a>
        )
      })}
    </div>
  )
}
