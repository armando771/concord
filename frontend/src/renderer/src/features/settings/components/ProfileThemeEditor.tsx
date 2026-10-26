import {
  PROFILE_BACKGROUNDS,
  PROFILE_BORDERS,
  PROFILE_EFFECTS,
  PROFILE_PRESETS,
  profileThemeLook,
  sameTheme,
  withBackground,
  withBorder,
  type ProfileTheme
} from '../../profile/lib/profileTheme'
import ProfileCardFrame from '../../profile/components/ProfileCardFrame'

const optionClass = (active: boolean): string =>
  `cursor-pointer rounded-md border px-3 py-2 text-left text-ds-sm text-strong transition-colors ${
    active ? 'border-brand bg-fg/10' : 'border-subtle bg-black/30 hover:bg-fg/10'
  }`

function Options<T extends { id: string; label: string }>({
  label,
  options,
  value,
  onPick
}: {
  label: string
  options: readonly T[]
  value: string
  onPick: (id: string) => void
}): React.JSX.Element {
  return (
    <div>
      <p className="mb-2 text-xs text-gray-400">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            className={optionClass(value === o.id)}
            onClick={() => onPick(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ColorPickers({
  labels,
  colors,
  onChange
}: {
  labels: string[]
  colors: string[]
  onChange: (colors: string[]) => void
}): React.JSX.Element | null {
  if (labels.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4">
      {labels.map((label, i) => (
        <label key={label} className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="color"
            aria-label={label}
            value={colors[i] ?? '#5865f2'}
            onChange={(ev) => {
              const next = [...colors]
              next[i] = ev.target.value
              onChange(next)
            }}
            className="h-8 w-12 cursor-pointer rounded border border-subtle bg-transparent"
          />
          {label}
        </label>
      ))}
    </div>
  )
}

const BORDER_COLOR_LABELS: Record<string, string[]> = {
  solid: ['Cor da borda'],
  neon: ['Cor do neon'],
  gradient: ['Cor inicial', 'Cor final']
}
const BACKGROUND_COLOR_LABELS: Record<string, string[]> = {
  solid: ['Cor do fundo'],
  gradient: ['Cor principal', 'Cor de destaque']
}

/**
 * Tema do cartão de perfil (Configurações → Perfis): predefinições, borda,
 * fundo (cor ou degradê principal → destaque, como o tema do Nitro) e efeito.
 * Quem mostra o resultado é a prévia ao lado.
 */
export default function ProfileThemeEditor({
  value,
  onChange
}: {
  value: ProfileTheme
  onChange: (next: ProfileTheme) => void
}): React.JSX.Element {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs text-gray-400">Predefinições</p>
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-5"
          role="group"
          aria-label="Predefinições"
        >
          {PROFILE_PRESETS.map((preset) => {
            const active = sameTheme(preset.theme, value)
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                title={preset.label}
                onClick={() => onChange(preset.theme)}
                className={`group cursor-pointer rounded-lg p-1 text-center transition-colors ${
                  active ? 'bg-fg/10 ring-2 ring-brand' : 'hover:bg-fg/5'
                }`}
              >
                <ProfileCardFrame
                  look={profileThemeLook(preset.theme)}
                  aria-hidden="true"
                  className="mx-auto h-12 w-full"
                >
                  <span />
                </ProfileCardFrame>
                <span className="mt-1 block truncate text-[11px] text-gray-300">
                  {preset.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <Options
          label="Borda"
          options={PROFILE_BORDERS}
          value={value.border}
          onPick={(id) => onChange(withBorder(value, id))}
        />
        <ColorPickers
          labels={BORDER_COLOR_LABELS[value.border] ?? []}
          colors={value.border_colors}
          onChange={(border_colors) => onChange({ ...value, border_colors })}
        />
      </div>

      <div>
        <Options
          label="Fundo do perfil"
          options={PROFILE_BACKGROUNDS}
          value={value.background}
          onPick={(id) => onChange(withBackground(value, id))}
        />
        <ColorPickers
          labels={BACKGROUND_COLOR_LABELS[value.background] ?? []}
          colors={value.background_colors}
          onChange={(background_colors) => onChange({ ...value, background_colors })}
        />
        {value.background !== 'default' && (
          <p className="mt-2 text-xs text-gray-500">
            O texto fica claro ou escuro sozinho, para dar para ler em qualquer cor.
          </p>
        )}
      </div>

      <Options
        label="Efeito"
        options={PROFILE_EFFECTS}
        value={value.effect}
        onPick={(effect) => onChange({ ...value, effect })}
      />
    </div>
  )
}
