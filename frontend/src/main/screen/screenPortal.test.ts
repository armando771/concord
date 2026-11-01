import { describe, expect, it } from 'vitest'
import { probeOutcome } from './screenPortal'

describe('probeOutcome', () => {
  it('saiu com 0: o portal respondeu', () => {
    expect(probeOutcome(null)).toBe('ok')
  })

  it('programa não instalado: tenta o próximo', () => {
    expect(probeOutcome(Object.assign(new Error('spawn gdbus ENOENT'), { code: 'ENOENT' }))).toBe(
      'no-tool'
    )
  })

  it('morto pelo timeout: sem resposta', () => {
    expect(probeOutcome(Object.assign(new Error('x'), { killed: true, signal: 'SIGTERM' }))).toBe(
      'timeout'
    )
  })

  it('código de saída de erro (sem a interface, sem barramento): portal ausente', () => {
    expect(probeOutcome(Object.assign(new Error('No such interface'), { code: 1 }))).toBe('failed')
  })
})
