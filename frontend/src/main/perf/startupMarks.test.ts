import { describe, expect, it } from 'vitest'
import { StartupMarks } from './startupMarks'

describe('StartupMarks', () => {
  it('só entrega a linha quando os três marcos chegaram', () => {
    const marks = new StartupMarks()
    marks.mark('appReady', 310.4)
    marks.mark('readyToShow', 1240)
    expect(marks.take(2000)).toBeNull()
    marks.mark('usable', 2050)
    expect(marks.take(2100)).toEqual({
      kind: 'startup',
      appReadyMs: 310,
      readyToShowMs: 1240,
      usableMs: 2050
    })
  })

  it('aceita usable chegando antes do ready-to-show', () => {
    const marks = new StartupMarks()
    marks.mark('appReady', 100)
    marks.mark('usable', 900)
    marks.mark('readyToShow', 1200)
    expect(marks.take(1300)).toMatchObject({ readyToShowMs: 1200, usableMs: 900 })
  })

  it('passado 1 minuto entrega com o marco que faltou como null', () => {
    const marks = new StartupMarks()
    marks.mark('appReady', 100)
    marks.mark('readyToShow', 800)
    expect(marks.take(59_999)).toBeNull()
    expect(marks.take(60_000)).toEqual({
      kind: 'startup',
      appReadyMs: 100,
      readyToShowMs: 800,
      usableMs: null
    })
  })

  it('entrega uma vez só e ignora marco repetido', () => {
    const marks = new StartupMarks()
    marks.mark('appReady', 100)
    marks.mark('appReady', 5000)
    marks.mark('readyToShow', 200)
    marks.mark('usable', 300)
    expect(marks.take(400)).toMatchObject({ appReadyMs: 100 })
    expect(marks.take(500)).toBeNull()
  })
})
