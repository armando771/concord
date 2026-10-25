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

export interface BirthdayValue {
  day: number | null
  month: number | null
}

/** Dias possíveis no mês (fevereiro aceita 29, como o backend). */
export function daysInMonth(month: number | null): number {
  if (!month) return 31
  return new Date(2024, month, 0).getDate()
}

/**
 * Pode salvar: os dois vazios (sem aniversário) ou dia e mês válidos.
 * Devolve a mensagem de erro, ou null.
 */
export function birthdayError({ day, month }: BirthdayValue): string | null {
  if (day === null && month === null) return null
  if (day === null || month === null) {
    return 'Escolha o dia e o mês do aniversário, ou deixe os dois em branco.'
  }
  if (day < 1 || day > daysInMonth(month)) return 'Esse dia não existe nesse mês.'
  return null
}

/** Chave do "modal de aniversário já visto hoje" neste computador. */
export function birthdayModalKey(userId: string, date: string): string {
  return `concord:birthday-modal:${userId}:${date}`
}
