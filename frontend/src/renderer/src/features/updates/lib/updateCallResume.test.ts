import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createCallResumer } from './updateCallResume'
import { CALL_RESUME_TTL_MS, type PendingCallResume } from '../../../../../shared/callResume'

type Dependencies = Parameters<typeof createCallResumer>[0]

function fixture(): {
  resume: PendingCallResume
  context: { userId: string | null; backendUrl: string; connected: boolean; idle: boolean }
  deps: Dependencies & { join: Mock<Dependencies['join']> }
  resumer: ReturnType<typeof createCallResumer>
} {
  const resume = {
    userId: 'me',
    backendUrl: 'api',
    serverId: 's',
    channelId: 'c',
    muted: true,
    deafened: false,
    mutedBeforeDeafen: false,
    savedAt: Date.now()
  }
  const context = { userId: 'me', backendUrl: 'api', connected: true, idle: true }
  const deps = {
    take: vi.fn(async () => resume),
    context: () => context,
    join: vi.fn<Dependencies['join']>().mockResolvedValue(undefined),
    navigate: vi.fn(),
    failed: vi.fn(),
    permanent: (error: unknown) => error === 'forbidden'
  }
  return { resume, context, deps, resumer: createCallResumer(deps) }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('retomada após atualização', () => {
  it('aguarda o carregamento do usuário autenticado', async () => {
    const { context, deps, resumer } = fixture()
    context.userId = null
    await resumer.tick()
    expect(deps.join).not.toHaveBeenCalled()
    context.userId = 'me'
    await resumer.tick()
    expect(deps.join).toHaveBeenCalledTimes(1)
  })

  it('aguarda o WS e retoma apenas uma vez', async () => {
    const { context, deps, resumer, resume } = fixture()
    context.connected = false
    await resumer.tick()
    expect(deps.join).not.toHaveBeenCalled()
    context.connected = true
    await resumer.tick()
    await resumer.tick()
    expect(deps.take).toHaveBeenCalledTimes(1)
    expect(deps.join).toHaveBeenCalledExactlyOnceWith(resume, expect.any(AbortSignal))
    expect(deps.navigate).toHaveBeenCalledWith(resume)
  })
  it.each(['userId', 'backendUrl', 'idle'] as const)(
    'descarta contexto diferente: %s',
    async (key) => {
      const { context, deps, resumer } = fixture()
      if (key === 'idle') context.idle = false
      else context[key] = 'different'
      await resumer.tick()
      expect(deps.join).not.toHaveBeenCalled()
    }
  )
  it('não retoma registro expirado enquanto estava offline', async () => {
    const { context, deps, resumer } = fixture()
    context.connected = false
    await resumer.tick()
    vi.advanceTimersByTime(CALL_RESUME_TTL_MS)
    context.connected = true
    await resumer.tick()
    expect(deps.join).not.toHaveBeenCalled()
  })
  it('limita tentativas transitórias e não repete em erro permanente', async () => {
    const { deps, resumer } = fixture()
    deps.join.mockRejectedValue(new Error('offline'))
    for (let i = 0; i < 5; i++) {
      await resumer.tick()
      vi.advanceTimersByTime(3000)
    }
    expect(deps.join).toHaveBeenCalledTimes(3)
    expect(deps.failed).toHaveBeenCalledTimes(1)
    const second = fixture()
    second.deps.join.mockRejectedValue('forbidden')
    await second.resumer.tick()
    vi.advanceTimersByTime(3000)
    await second.resumer.tick()
    expect(second.deps.join).toHaveBeenCalledTimes(1)
  })
  it('cancela durante uma entrada em andamento sem navegar', async () => {
    const { deps, resumer } = fixture()
    let finish!: () => void
    deps.join.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const work = resumer.tick()
    await Promise.resolve()
    resumer.cancel()
    expect(deps.join.mock.calls[0][1].aborted).toBe(true)
    finish()
    await work
    expect(deps.navigate).not.toHaveBeenCalled()
  })
})

describe('retomada decidida (settled)', () => {
  it('não decidiu antes de ler o arquivo nem enquanto tenta voltar', async () => {
    const { deps, resumer } = fixture()
    expect(resumer.settled()).toBe(false)
    let finish: () => void = () => {}
    deps.join.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    const tick = resumer.tick()
    await Promise.resolve()
    expect(resumer.settled()).toBe(false)
    finish()
    await tick
    expect(resumer.settled()).toBe(true)
  })

  it('sem retomada pendente, decide no primeiro tick', async () => {
    const { deps } = fixture()
    const resumer = createCallResumer({ ...deps, take: async () => null })
    await resumer.tick()
    expect(resumer.settled()).toBe(true)
  })

  it('erro transitório ainda vai tentar de novo; cancelar decide', async () => {
    const { deps, resumer } = fixture()
    deps.join.mockRejectedValue(new Error('rede'))
    await resumer.tick()
    expect(resumer.settled()).toBe(false)
    resumer.cancel()
    expect(resumer.settled()).toBe(true)
  })
})
