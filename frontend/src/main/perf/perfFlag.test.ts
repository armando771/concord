import { describe, expect, it } from 'vitest'
import { isPerfLogEnabled } from './perfFlag'

describe('isPerfLogEnabled', () => {
  it('liga com --perf-log no argv', () => {
    expect(isPerfLogEnabled(['Salinha.exe', '--perf-log'], {})).toBe(true)
  })

  it('liga com SALINHA_PERF_LOG=1', () => {
    expect(isPerfLogEnabled(['Salinha.exe'], { SALINHA_PERF_LOG: '1' })).toBe(true)
  })

  it('fica desligado sem nenhum dos dois', () => {
    expect(isPerfLogEnabled(['Salinha.exe'], {})).toBe(false)
    expect(isPerfLogEnabled(['Salinha.exe'], { SALINHA_PERF_LOG: '0' })).toBe(false)
    expect(isPerfLogEnabled(['Salinha.exe'], { SALINHA_PERF_LOG: '' })).toBe(false)
  })
})
