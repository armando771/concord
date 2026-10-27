import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  fetch: vi.fn(),
  handle: vi.fn(),
  appendLog: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '0.6.9' },
  ipcMain: { handle: electron.handle },
  net: { fetch: electron.fetch }
}))
vi.mock('../app/appLog', () => ({ appendLog: electron.appendLog }))

import { registerServerDiagnostics, startServerChoice } from './serverSetup'

const PRIMARY = 'https://74-0-5-252.sslip.io'
const FALLBACK = 'https://app-salinha.bhrx.com.br'

function answerBy(by: Record<string, number | Error>): void {
  electron.fetch.mockImplementation((url: string) => {
    const answer = by[new URL(url).origin]
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ status: answer })
  })
}

async function diagnostics(retest: boolean): Promise<unknown> {
  const handler = electron.handle.mock.calls.find(([channel]) => channel === 'server:diagnostics')
  return handler?.[1]({}, retest)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('startServerChoice', () => {
  it('dev (sem endereço no build): não testa nada', async () => {
    expect(await startServerChoice([])).toBeNull()
    expect(electron.fetch).not.toHaveBeenCalled()
  })

  it('escolhe pelo net.fetch e registra o resultado no conexao.log', async () => {
    answerBy({ [PRIMARY]: new Error('net::ERR_NAME_NOT_RESOLVED'), [FALLBACK]: 200 })
    const choice = await startServerChoice([PRIMARY, FALLBACK])
    expect(choice?.url).toBe(FALLBACK)
    await choice?.probes
    await Promise.resolve()
    const [file, line] = electron.appendLog.mock.calls[0]
    expect(file).toBe('conexao.log')
    expect(line).toContain(`versão 0.6.9, usando ${FALLBACK}`)
    expect(line).toContain(`${PRIMARY}: falhou (net::ERR_NAME_NOT_RESOLVED`)
  })
})

describe('registerServerDiagnostics', () => {
  it('devolve versão, endereço em uso e os testes da abertura', async () => {
    answerBy({ [PRIMARY]: 200, [FALLBACK]: 200 })
    const candidates = [PRIMARY, FALLBACK]
    registerServerDiagnostics(startServerChoice(candidates), candidates)
    expect(await diagnostics(false)).toMatchObject({
      version: '0.6.9',
      server: PRIMARY,
      primary: PRIMARY,
      probes: [{ url: PRIMARY, ok: true }, { url: FALLBACK, ok: true }]
    })
  })

  it('"Testar de novo" refaz os testes agora', async () => {
    answerBy({ [PRIMARY]: 200, [FALLBACK]: 200 })
    const candidates = [PRIMARY, FALLBACK]
    registerServerDiagnostics(startServerChoice(candidates), candidates)
    await diagnostics(false)
    answerBy({ [PRIMARY]: new Error('net::ERR_CONNECTION_RESET'), [FALLBACK]: 200 })
    const again = (await diagnostics(true)) as { probes: { detail: string }[] }
    expect(again.probes[0].detail).toBe('net::ERR_CONNECTION_RESET')
  })

  it('dev: sem detalhes', async () => {
    registerServerDiagnostics(startServerChoice([]), [])
    expect(await diagnostics(true)).toBeNull()
  })
})
