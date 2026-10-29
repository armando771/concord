import { dayLabelText, timeText } from './dayLabel'

describe('dayLabelText', () => {
  it('escreve o dia por extenso em português', () => {
    expect(dayLabelText('2026-10-28')).toBe('28 de outubro de 2026')
    expect(dayLabelText('2026-01-05')).toBe('5 de janeiro de 2026')
  })
})

describe('timeText', () => {
  it('hora e minuto com dois dígitos, no fuso pedido', () => {
    expect(timeText('2026-10-28T09:05:00Z', 'UTC')).toBe('09:05')
    expect(timeText('2026-10-28T23:51:00Z', 'UTC')).toBe('23:51')
  })
})
