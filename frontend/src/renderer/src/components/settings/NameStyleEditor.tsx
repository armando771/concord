import { NAME_EFFECTS, NAME_FONTS, defaultColorsFor, type NameStyle } from '../../lib/nameStyle'
import StyledName from '../StyledName'

/** Troca o efeito mantendo as cores que ainda servem e completando as que faltam. */
function withEffect(style: NameStyle, effectId: string): NameStyle {
  const def = NAME_EFFECTS.find((e) => e.id === effectId)
  if (!def) return style
  const kept = style.colors.slice(0, def.maxColors)
  const fill = defaultColorsFor(effectId).slice(kept.length)
  return { ...style, effect: effectId, colors: [...kept, ...fill] }
}

const optionClass = (active: boolean): string =>
  `cursor-pointer rounded-md border px-3 py-2 text-left text-ds-sm text-strong transition-colors ${
    active ? 'border-brand bg-fg/10' : 'border-subtle bg-input hover:bg-fg/10'
  }`

export default function NameStyleEditor({
  value,
  previewName,
  onChange
}: {
  value: NameStyle
  previewName: string
  onChange: (next: NameStyle) => void
}): React.JSX.Element {
  const effect = NAME_EFFECTS.find((e) => e.id === value.effect) ?? NAME_EFFECTS[0]
  return (
    <div className="space-y-4">
      <div className="truncate rounded-md bg-input px-4 py-3 text-lg text-strong">
        <StyledName name={previewName || 'Seu nome'} style={value} />
      </div>

      <div>
        <p className="mb-2 text-xs text-gray-400">Fonte</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NAME_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={value.font === f.id}
              className={optionClass(value.font === f.id)}
              onClick={() => onChange({ ...value, font: f.id })}
            >
              <StyledName name={f.label} style={{ font: f.id, effect: 'solid', colors: [] }} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-gray-400">Efeito</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NAME_EFFECTS.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={value.effect === e.id}
              className={optionClass(value.effect === e.id)}
              onClick={() => onChange(withEffect(value, e.id))}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {effect.maxColors > 0 && (
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400">{effect.maxColors > 1 ? 'Cores' : 'Cor'}</p>
          {Array.from({ length: effect.maxColors }, (_, i) => (
            <input
              key={i}
              type="color"
              aria-label={`Cor ${i + 1}`}
              value={value.colors[i] ?? '#5865f2'}
              onChange={(ev) => {
                const colors = [...value.colors]
                colors[i] = ev.target.value
                onChange({ ...value, colors })
              }}
              className="h-8 w-12 cursor-pointer rounded border border-subtle bg-transparent"
            />
          ))}
        </div>
      )}
    </div>
  )
}
