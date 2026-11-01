import { NAME_EFFECTS, NAME_FONTS, type NameStyle } from '../../profile/lib/nameStyle'
import { withEffect } from '../../profile/lib/nameStylePicker'
import StyledName from '../../profile/components/StyledName'

const optionClass = (active: boolean): string =>
  `min-h-10 min-w-0 cursor-pointer truncate rounded-lg border px-2.5 py-1.5 text-left text-ds-sm text-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
    active ? 'border-brand bg-brand/15' : 'border-subtle bg-fg/5 hover:bg-fg/10'
  }`

/** Fonte, efeito e cores do nome (a prévia fica com quem usa, ex.: o modal do nome). */
export default function NameStyleEditor({
  value,
  onChange
}: {
  value: NameStyle
  onChange: (next: NameStyle) => void
}): React.JSX.Element {
  const effect = NAME_EFFECTS.find((e) => e.id === value.effect) ?? NAME_EFFECTS[0]
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Fonte
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1.5">
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
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Efeito
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1.5">
          {NAME_EFFECTS.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={value.effect === e.id}
              className={optionClass(value.effect === e.id)}
              onClick={() => onChange(withEffect(value, e.id))}
            >
              {/* O botão já mostra o efeito (com as cores atuais, se servirem). */}
              <StyledName name={e.label} style={{ ...withEffect(value, e.id), font: 'default' }} />
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
              className="h-10 w-12 cursor-pointer rounded-lg border border-subtle bg-transparent"
            />
          ))}
        </div>
      )}
    </div>
  )
}
