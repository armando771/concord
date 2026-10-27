import { describe, expect, it } from 'vitest'
import { serverArgs, serverFromArgv } from './serverConnection'

describe('serverArgs / serverFromArgv', () => {
  it('o endereço escolhido pelo main chega ao preload pela linha de comando', () => {
    const argv = ['electron', '--type=renderer', ...serverArgs('https://app-salinha.bhrx.com.br')]
    expect(serverFromArgv(argv)).toBe('https://app-salinha.bhrx.com.br')
  })

  it('sem escolha (dev, overlay): nada na linha de comando e o renderer usa o do build', () => {
    expect(serverArgs(undefined)).toEqual([])
    expect(serverFromArgv(['electron', '--type=renderer'])).toBeNull()
  })

  it('ignora valor que não é um endereço http(s)', () => {
    expect(serverFromArgv(['--salinha-server=javascript:alert(1)'])).toBeNull()
    expect(serverFromArgv(['--salinha-server='])).toBeNull()
    expect(serverFromArgv(['--salinha-server=nada'])).toBeNull()
  })
})
