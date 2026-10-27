import { ColorSwatch, EditorSection } from './controls'

export const DEFAULT_BANNER = 'linear-gradient(135deg, #5865f2, #8b5cf6)'

const smallButton =
  'min-h-10 cursor-pointer rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
const primaryClass = `${smallButton} bg-brand text-white hover:bg-brand-hover`
const secondaryClass = `${smallButton} bg-fg/10 text-strong hover:bg-fg/15`

function MediaButtons({
  what,
  has,
  onPick,
  onRemove
}: {
  what: 'avatar' | 'banner'
  has: boolean
  onPick: () => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={onPick} className={primaryClass}>
        Alterar {what}
      </button>
      {has && (
        <button type="button" onClick={onRemove} className={secondaryClass}>
          Remover {what}
        </button>
      )}
    </div>
  )
}

/** Miniatura redonda do avatar (ou a inicial do nome). */
function AvatarThumb({ url, name }: { url: string | null; name: string }): React.JSX.Element {
  return (
    <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-xl font-semibold text-white">
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}

/** Miniatura do banner: a imagem, ou a cor escolhida, ou o degradê padrão. */
function BannerThumb({
  url,
  color
}: {
  url: string | null
  color: string | null
}): React.JSX.Element {
  return (
    <span
      className="block h-16 w-full min-w-0 overflow-hidden rounded-lg border border-subtle"
      style={{ background: color ?? DEFAULT_BANNER }}
    >
      {url && <img src={url} alt="" className="size-full object-cover" />}
    </span>
  )
}

/**
 * Avatar e banner lado a lado, com miniatura, trocar/remover e a cor do
 * banner (vale quando não há imagem).
 */
export default function ProfileMediaFields({
  name,
  avatarUrl,
  bannerUrl,
  bannerColor,
  error,
  onPick,
  onRemove,
  onBannerColor
}: {
  name: string
  avatarUrl: string | null
  bannerUrl: string | null
  bannerColor: string | null
  error?: string
  onPick: (kind: 'avatar' | 'banner') => void
  onRemove: (kind: 'avatar' | 'banner') => void
  onBannerColor: (color: string | null) => void
}): React.JSX.Element {
  return (
    <EditorSection
      title="Avatar e banner"
      description="PNG, JPG, WebP ou GIF animado, até 10 MB. Dá para recortar antes de salvar."
    >
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-3 sm:flex-col sm:items-start">
          <AvatarThumb url={avatarUrl} name={name} />
          <MediaButtons
            what="avatar"
            has={Boolean(avatarUrl)}
            onPick={() => onPick('avatar')}
            onRemove={() => onRemove('avatar')}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <BannerThumb url={bannerUrl} color={bannerColor} />
          <MediaButtons
            what="banner"
            has={Boolean(bannerUrl)}
            onPick={() => onPick('banner')}
            onRemove={() => onRemove('banner')}
          />
          <div className="flex flex-wrap items-center gap-2">
            <ColorSwatch
              label="Cor do banner"
              value={bannerColor ?? '#5865f2'}
              onChange={onBannerColor}
            />
            {bannerColor && (
              <button
                type="button"
                onClick={() => onBannerColor(null)}
                className="min-h-10 cursor-pointer px-1 text-xs text-link hover:underline"
              >
                Usar a cor padrão
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">A cor aparece quando não há imagem de banner.</p>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </div>
    </EditorSection>
  )
}
