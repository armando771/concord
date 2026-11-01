import { describe, expect, it } from 'vitest'
import { helperBroken, lineSplitter, nextFailures, restartDelay } from './processLines'

describe('lineSplitter', () => {
  it('junta pedaços e entrega linhas inteiras, sem \\r e sem linhas vazias', () => {
    const lines: string[] = []
    const feed = lineSplitter((line) => lines.push(line))
    feed('[{"a":')
    feed('1}]\r\n[]\r')
    feed('\n\r\n{"b":2}\n')
    expect(lines).toEqual(['[{"a":1}]', '[]', '{"b":2}'])
  })

  it('descarta linha absurda de grande (processo desgovernado)', () => {
    const lines: string[] = []
    const feed = lineSplitter((line) => lines.push(line), 10)
    feed('x'.repeat(50))
    feed('\nok\n')
    expect(lines).toEqual(['ok'])
  })
})

describe('restartDelay', () => {
  it('reabre logo depois de uma queda e desiste depois de três seguidas', () => {
    expect(restartDelay(0)).toBe(30_000)
    expect(restartDelay(1)).toBe(30_000)
    expect(restartDelay(2)).toBe(60_000)
    expect(restartDelay(3)).toBeNull()
  })
})

describe('nextFailures', () => {
  it('queda logo ao abrir soma; depois de rodar bem, zera', () => {
    expect(nextFailures(1, 2_000)).toBe(2)
    expect(nextFailures(2, 60_000)).toBe(0)
  })
})

describe('helperBroken', () => {
  it('só quando saiu logo e sem nenhuma leitura', () => {
    expect(helperBroken(500, false)).toBe(true)
    expect(helperBroken(500, true)).toBe(false)
    expect(helperBroken(60_000, false)).toBe(false)
  })
})
