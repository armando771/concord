import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDownloadScheduler,
  type DownloadScheduler,
  type DownloadSchedulerDeps
} from './downloadScheduler'

const release = { version: '0.7.0', sha512: 'aa' }
const FILE = 'Salinha-0.7.0.exe'

interface Setup {
  scheduler: DownloadScheduler
  deps: DownloadSchedulerDeps & {
    download: ReturnType<typeof vi.fn>
    fetchSignature: ReturnType<typeof vi.fn>
    onFailure: ReturnType<typeof vi.fn>
    onSignatureUnavailable: ReturnType<typeof vi.fn>
  }
  state: { wanted: boolean }
}

function setup(over: Partial<DownloadSchedulerDeps> = {}): Setup {
  const state = { wanted: true }
  const deps = {
    download: vi.fn(async () => {}),
    fetchSignature: vi.fn(async () => 'assinatura'),
    wanted: () => state.wanted,
    onFailure: vi.fn(),
    onSignatureUnavailable: vi.fn(),
    // aberto há muito tempo: fora da janela de início
    startedAt: Date.now() - 10 * 60_000,
    random: () => 0,
    ...over
  }
  const scheduler = createDownloadScheduler(deps)
  scheduler.offer(release, FILE)
  return { scheduler, deps: deps as Setup['deps'], state }
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createDownloadScheduler', () => {
  it('busca o .sig antes do pacote e guarda para a verificação', async () => {
    const { scheduler, deps } = setup()
    scheduler.request(false)
    await settle()
    expect(deps.fetchSignature).toHaveBeenCalledWith(FILE)
    expect(deps.download).toHaveBeenCalledTimes(1)
    expect(scheduler.signatureFor(FILE)).toBe('assinatura')
    expect(scheduler.signatureFor('outro')).toBeNull()
  })

  it('não baixa quando não falta nada', async () => {
    const { scheduler, deps, state } = setup()
    state.wanted = false
    scheduler.request(true)
    await settle()
    expect(deps.download).not.toHaveBeenCalled()
  })

  it('não começa outro download enquanto um está em andamento', async () => {
    const { scheduler, deps } = setup()
    scheduler.request(false)
    await settle()
    scheduler.request(true)
    await settle()
    expect(deps.download).toHaveBeenCalledTimes(1)
    scheduler.settled()
    scheduler.request(false)
    await settle()
    expect(deps.download).toHaveBeenCalledTimes(2)
  })

  it('sorteia a espera em segundo plano; o clique fura a fila uma vez só', async () => {
    const { scheduler, deps } = setup({ random: () => 0.5 })
    scheduler.request(false)
    await settle()
    expect(deps.download).not.toHaveBeenCalled()
    // checagem repetida não reinicia o sorteio
    vi.advanceTimersByTime(40_000)
    scheduler.request(false)
    scheduler.request(true)
    await settle()
    expect(deps.download).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(120_000)
    await settle()
    expect(deps.download).toHaveBeenCalledTimes(1)
  })

  it('o sorteio termina e baixa', async () => {
    const { scheduler, deps } = setup({ random: () => 0.5 })
    scheduler.request(false)
    vi.advanceTimersByTime(60_000)
    await settle()
    expect(deps.download).toHaveBeenCalledTimes(1)
  })

  it('sem .sig não baixa o pacote e espera cada vez mais; o clique fura a espera', async () => {
    const { scheduler, deps } = setup({
      fetchSignature: vi.fn(async () => {
        throw new Error('404')
      })
    })
    scheduler.request(false)
    await settle()
    expect(deps.download).not.toHaveBeenCalled()
    expect(deps.onFailure).toHaveBeenCalledWith('assinatura indisponível', expect.any(Error), 60_000)
    expect(deps.onSignatureUnavailable).toHaveBeenCalledTimes(1)

    scheduler.request(false)
    await settle()
    expect(deps.fetchSignature).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_000)
    scheduler.request(false)
    await settle()
    expect(deps.fetchSignature).toHaveBeenCalledTimes(2)
    expect(deps.onFailure).toHaveBeenLastCalledWith(
      'assinatura indisponível',
      expect.any(Error),
      5 * 60_000
    )
    scheduler.request(true)
    await settle()
    expect(deps.fetchSignature).toHaveBeenCalledTimes(3)
  })

  it('download que falha entra na espera; sucesso zera', async () => {
    const download = vi.fn(async () => {
      throw new Error('rede')
    })
    const { scheduler, deps } = setup({ download })
    scheduler.request(false)
    await settle()
    expect(deps.onFailure).toHaveBeenCalledWith('download falhou', expect.any(Error), 60_000)
    scheduler.request(false)
    await settle()
    expect(download).toHaveBeenCalledTimes(1)

    scheduler.succeeded()
    scheduler.request(false)
    await settle()
    expect(download).toHaveBeenCalledTimes(2)
  })

  it('falha na verificação conta para a espera', async () => {
    const { scheduler, deps } = setup()
    scheduler.failed('assinatura indisponível', new Error('x'))
    scheduler.request(false)
    await settle()
    expect(deps.download).not.toHaveBeenCalled()
  })

  it('manifesto novo (versão ou sha512) zera a espera e o .sig guardado', async () => {
    const { scheduler, deps } = setup()
    scheduler.request(false)
    await settle()
    scheduler.settled()
    scheduler.failed('x', new Error('x'))
    scheduler.offer(release, FILE)
    expect(scheduler.signatureFor(FILE)).toBe('assinatura')

    scheduler.offer({ ...release, sha512: 'bb' }, FILE)
    expect(scheduler.release()).toEqual({ ...release, sha512: 'bb' })
    expect(scheduler.signatureFor(FILE)).toBeNull()
    scheduler.request(false)
    await settle()
    expect(deps.download).toHaveBeenCalledTimes(2)
  })

  it('forgetSignature apaga o .sig guardado', async () => {
    const { scheduler } = setup()
    scheduler.request(false)
    await settle()
    scheduler.forgetSignature()
    expect(scheduler.signatureFor(FILE)).toBeNull()
  })

  it('sem arquivo no manifesto baixa direto (o .sig vem depois)', async () => {
    const { scheduler, deps } = setup()
    scheduler.offer({ version: '0.8.0', sha512: '' }, null)
    scheduler.request(false)
    await settle()
    expect(deps.fetchSignature).not.toHaveBeenCalled()
    expect(deps.download).toHaveBeenCalledTimes(1)
  })

  it('o fim do sorteio confere de novo se ainda falta baixar', async () => {
    const { scheduler, deps, state } = setup({ random: () => 0.5 })
    scheduler.request(false)
    state.wanted = false
    vi.advanceTimersByTime(60_000)
    await settle()
    expect(deps.download).not.toHaveBeenCalled()
  })
})
