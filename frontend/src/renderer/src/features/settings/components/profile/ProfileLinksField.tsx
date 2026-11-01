import { MAX_LINKS, detectProvider, normalizeLink } from '../../../profile/lib/profileLinks'
import LinkIcon from '../../../profile/components/LinkIcon'
import { PlusIcon, XIcon } from '../../../../shared/ui/icons'
import { Field, SecondaryButton, inputClass } from './ProfileField'

function LinkRow({
  link,
  index,
  error,
  onChange,
  onRemove
}: {
  link: string
  index: number
  error?: string | null
  onChange: (value: string) => void
  onRemove: () => void
}): React.JSX.Element {
  const provider = detectProvider(normalizeLink(link))
  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-fg/5 text-gray-300"
          title={provider.label}
        >
          <LinkIcon provider={provider.id} />
        </span>
        <input
          value={link}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://steamcommunity.com/id/voce"
          className={inputClass}
          aria-label={`Link ${index + 1}`}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover link ${index + 1}`}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="ml-11 mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

/** Links do perfil (Steam, Twitch, GitHub... ou qualquer site). */
export default function ProfileLinksField({
  links,
  error,
  linkErrors,
  onChange
}: {
  links: string[]
  error?: string
  linkErrors?: (string | null)[]
  onChange: (links: string[]) => void
}): React.JSX.Element {
  const full = links.length >= MAX_LINKS
  return (
    <Field
      label="Links"
      hint="Steam, Twitch, YouTube, X, Instagram, TikTok, GitHub, Spotify ou qualquer site."
      error={error}
    >
      <div className="flex flex-col gap-2">
        {links.map((link, i) => (
          <LinkRow
            key={i}
            link={link}
            index={i}
            error={linkErrors?.[i]}
            onChange={(value) => onChange(links.map((l, j) => (j === i ? value : l)))}
            onRemove={() => onChange(links.filter((_, j) => j !== i))}
          />
        ))}
        <div>
          <SecondaryButton onClick={() => onChange([...links, ''])} disabled={full}>
            <span className="flex items-center gap-1.5">
              <PlusIcon className="h-4 w-4" />
              Adicionar link
            </span>
          </SecondaryButton>
          {full && <span className="ml-3 text-xs text-gray-500">Máximo de {MAX_LINKS} links.</span>}
        </div>
      </div>
    </Field>
  )
}
