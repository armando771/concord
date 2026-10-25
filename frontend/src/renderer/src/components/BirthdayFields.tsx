import { birthYears, daysInMonth, MONTHS, type BirthdayValue } from '../lib/birthday'

const selectClass = 'glass-input !py-2 text-sm'

/** Dia, mês e ano do aniversário (opcional; a idade só a própria pessoa vê). */
function BirthdayFields({
  value,
  onChange,
  label = 'Aniversário (opcional)'
}: {
  value: BirthdayValue
  onChange: (value: BirthdayValue) => void
  label?: string
}): React.JSX.Element {
  const maxDay = daysInMonth(value.month, value.year)

  // Ex.: dia 31 e troca para abril, ou 29/02 e troca para um ano não
  // bissexto → o dia vira o último que existe.
  const fit = (next: BirthdayValue): BirthdayValue => {
    const last = daysInMonth(next.month, next.year)
    return next.day && next.day > last ? { ...next, day: last } : next
  }
  const num = (v: string): number | null => (v ? Number(v) : null)

  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-ds-sm font-medium text-gray-300">{label}</span>
      <div className="flex gap-2">
        <select
          aria-label="Dia do aniversário"
          value={value.day ?? ''}
          onChange={(e) => onChange({ ...value, day: num(e.target.value) })}
          className={`${selectClass} w-20`}
        >
          <option value="" className="bg-[#111214]">
            Dia
          </option>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d} className="bg-[#111214]">
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Mês do aniversário"
          value={value.month ?? ''}
          onChange={(e) => onChange(fit({ ...value, month: num(e.target.value) }))}
          className={`${selectClass} min-w-0 flex-1`}
        >
          <option value="" className="bg-[#111214]">
            Mês
          </option>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1} className="bg-[#111214]">
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Ano do aniversário"
          value={value.year ?? ''}
          onChange={(e) => onChange(fit({ ...value, year: num(e.target.value) }))}
          className={`${selectClass} w-24`}
        >
          <option value="" className="bg-[#111214]">
            Ano
          </option>
          {birthYears().map((y) => (
            <option key={y} value={y} className="bg-[#111214]">
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default BirthdayFields
