export const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

export const MIN_BIRTH_YEAR = 1900

export interface BirthdayValue {
  day: number | null
  month: number | null
  year: number | null
}

/** Anos do seletor: do atual até 1900. */
export function birthYears(now: Date = new Date()): number[] {
  const years: number[] = []
  for (let y = now.getFullYear(); y >= MIN_BIRTH_YEAR; y--) years.push(y)
  return years
}

/**
 * Dias possíveis no mês. Sem ano escolhido, fevereiro aceita 29; com ano,
 * só se ele for bissexto.
 */
export function daysInMonth(month: number | null, year: number | null = null): number {
  if (!month) return 31
  return new Date(year ?? 2024, month, 0).getDate()
}

/**
 * Pode salvar: tudo vazio (sem aniversário) ou dia, mês e ano de uma data
 * que existe e não está no futuro. Devolve a mensagem de erro, ou null.
 */
export function birthdayError(
  { day, month, year }: BirthdayValue,
  now: Date = new Date()
): string | null {
  if (day === null && month === null && year === null) return null
  if (day === null || month === null || year === null) {
    return 'Escolha o dia, o mês e o ano do aniversário, ou deixe tudo em branco.'
  }
  if (day < 1 || day > daysInMonth(month, year)) return 'Esse dia não existe nesse mês.'
  const date = new Date(year, month - 1, day)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (year < MIN_BIRTH_YEAR || date > today) return 'Essa data não vale.'
  return null
}

/** Chave do "modal de aniversário já visto hoje" neste computador. */
export function birthdayModalKey(userId: string, date: string): string {
  return `concord:birthday-modal:${userId}:${date}`
}
