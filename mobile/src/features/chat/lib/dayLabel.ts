const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
]

/** "2026-10-28" → "28 de outubro de 2026" (sem passar por Date: não depende de fuso). */
export function dayLabelText(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return `${date} de ${MONTHS[month - 1]} de ${year}`
}

/** Hora e minuto (24 h) de uma data ISO, no fuso do aparelho (ou no pedido). */
export function timeText(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(
    new Date(iso)
  )
}
