import { Field, SecondaryButton } from './ProfileField'

export const DEFAULT_BANNER = 'linear-gradient(135deg, #5865f2, #8b5cf6)'

const primaryClass =
  'cursor-pointer rounded-md bg-brand px-4 py-2 text-ds-sm font-medium text-white transition-colors hover:bg-brand-hover'

/** Avatar: trocar (abre o seletor de arquivo) ou remover. */
export function AvatarField({
  hasAvatar,
  onPick,
  onRemove
}: {
  hasAvatar: boolean
  onPick: () => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <Field label="Avatar" hint="PNG, JPG, WebP ou GIF animado, até 10 MB.">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onPick} className={primaryClass}>
          Alterar avatar
        </button>
        {hasAvatar && <SecondaryButton onClick={onRemove}>Remover avatar</SecondaryButton>}
      </div>
    </Field>
  )
}

function BannerColor({
  color,
  onChange
}: {
  color: string | null
  onChange: (color: string | null) => void
}): React.JSX.Element {
  return (
    <div className="mt-4 flex items-center gap-3">
      <label
        className="relative h-12 w-16 cursor-pointer overflow-hidden rounded-md border border-normal"
        style={{ background: color ?? DEFAULT_BANNER }}
        title="Escolher a cor do banner"
      >
        <input
          type="color"
          value={color ?? '#5865f2'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Cor do banner"
        />
      </label>
      <div className="text-xs text-gray-400">
        <p className="font-semibold text-gray-200">Cor do banner</p>
        <p>Aparece quando não há imagem de banner.</p>
        {color && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="mt-0.5 cursor-pointer text-link hover:underline"
          >
            Usar a cor padrão
          </button>
        )}
      </div>
    </div>
  )
}

/** Banner: imagem (trocar/remover) e a cor de quando não há imagem. */
export function BannerField({
  hasBanner,
  color,
  error,
  onPick,
  onRemove,
  onColor
}: {
  hasBanner: boolean
  color: string | null
  error?: string
  onPick: () => void
  onRemove: () => void
  onColor: (color: string | null) => void
}): React.JSX.Element {
  return (
    <Field label="Banner do perfil" hint="Imagem ou GIF (até 10 MB), ou só uma cor." error={error}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onPick} className={primaryClass}>
          Alterar banner
        </button>
        {hasBanner && <SecondaryButton onClick={onRemove}>Remover banner</SecondaryButton>}
      </div>
      <BannerColor color={color} onChange={onColor} />
    </Field>
  )
}
