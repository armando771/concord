import { isPlannedRestart, reconnectDelay, SERVICE_RESTART_CLOSE_CODE } from './wsReconnect'

describe('isPlannedRestart', () => {
  it('reconhece o 1012 que o servidor manda ao reiniciar', () => {
    expect(SERVICE_RESTART_CLOSE_CODE).toBe(1012)
    expect(isPlannedRestart(1012)).toBe(true)
    expect(isPlannedRestart(1006)).toBe(false)
    expect(isPlannedRestart(1000)).toBe(false)
  })
})

describe('reconnectDelay', () => {
  it('reinício planejado: primeira tentativa entre 100 e 300 ms (com jitter)', () => {
    expect(reconnectDelay(0, true, () => 0)).toBe(100)
    expect(reconnectDelay(0, true, () => 0.5)).toBe(200)
    expect(reconnectDelay(0, true, () => 0.999)).toBeLessThanOrEqual(300)
  })

  it('reinício planejado: se o servidor ainda não voltou, cresce a partir de 250 ms', () => {
    expect(reconnectDelay(1, true, () => 0.5)).toBe(250)
    expect(reconnectDelay(2, true, () => 0.5)).toBe(500)
    expect(reconnectDelay(3, true, () => 0.5)).toBe(1000)
    expect(reconnectDelay(30, true, () => 0.5)).toBe(30000)
  })

  it('queda comum: mantém o backoff de 1 s, 2 s, 4 s… até 30 s', () => {
    expect(reconnectDelay(0, false)).toBe(1000)
    expect(reconnectDelay(1, false)).toBe(2000)
    expect(reconnectDelay(2, false)).toBe(4000)
    expect(reconnectDelay(10, false)).toBe(30000)
  })
})
