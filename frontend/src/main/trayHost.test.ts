import { describe, expect, it } from 'vitest'
import { probeTrayHost } from './trayHost'

const missing = (): Error => Object.assign(new Error('spawn'), { code: 'ENOENT' })

describe('probeTrayHost', () => {
  it('true quando o host está registrado', async () => {
    const exec = async (): Promise<string> => '   variant       boolean true\n'
    expect(await probeTrayHost(exec)).toBe(true)
  })

  it('false quando não há host registrado', async () => {
    const exec = async (): Promise<string> => '   variant       boolean false\n'
    expect(await probeTrayHost(exec)).toBe(false)
  })

  it('false quando o watcher nem existe (sem painel com bandeja)', async () => {
    const exec = async (): Promise<string> => {
      throw Object.assign(new Error('ServiceUnknown'), { code: 1 })
    }
    expect(await probeTrayHost(exec)).toBe(false)
  })

  it('sem dbus-send, pergunta pelo gdbus e depois pelo busctl', async () => {
    const called: string[] = []
    const exec = async (cmd: string): Promise<string> => {
      called.push(cmd)
      if (cmd !== 'busctl') throw missing()
      return 'b true\n'
    }
    expect(await probeTrayHost(exec)).toBe(true)
    expect(called).toEqual(['dbus-send', 'gdbus', 'busctl'])
  })

  it('sem nenhuma ferramenta D-Bus, na dúvida responde false', async () => {
    const exec = async (): Promise<string> => {
      throw missing()
    }
    expect(await probeTrayHost(exec)).toBe(false)
  })

  it('erro que não é "ferramenta ausente" não tenta as outras', async () => {
    const called: string[] = []
    const exec = async (cmd: string): Promise<string> => {
      called.push(cmd)
      throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
    }
    expect(await probeTrayHost(exec)).toBe(false)
    expect(called).toEqual(['dbus-send'])
  })
})
