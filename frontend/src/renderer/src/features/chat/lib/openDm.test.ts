import { describe, expect, it, vi } from 'vitest'
import { openDm, type OpenDmDeps } from './openDm'

function deps(over: Partial<OpenDmDeps> = {}): OpenDmDeps {
  return {
    get: vi.fn().mockResolvedValue({ id: 'conv-1' }),
    isCancelled: () => false,
    onOpened: vi.fn(),
    onFailed: vi.fn(),
    ...over
  }
}

describe('openDm', () => {
  it('abre a conversa e entrega o id junto da pessoa pedida', async () => {
    const d = deps()
    await openDm('ana', d)
    expect(d.get).toHaveBeenCalledWith('ana')
    expect(d.onOpened).toHaveBeenCalledWith('ana', 'conv-1')
    expect(d.onFailed).not.toHaveBeenCalled()
  })

  it('se a tela já trocou de pessoa quando a resposta chega, descarta', async () => {
    const d = deps({ isCancelled: () => true })
    await openDm('ana', d)
    expect(d.onOpened).not.toHaveBeenCalled()
  })

  it('falha: avisa com a mensagem do erro, ligada à pessoa pedida', async () => {
    const d = deps({ get: vi.fn().mockRejectedValue(new Error('sem rede')) })
    await openDm('ana', d)
    expect(d.onFailed).toHaveBeenCalledWith('ana', 'sem rede')
  })

  it('falha que não é Error usa a mensagem padrão', async () => {
    const d = deps({ get: vi.fn().mockRejectedValue('x') })
    await openDm('ana', d)
    expect(d.onFailed).toHaveBeenCalledWith('ana', 'Falha ao abrir conversa.')
  })

  it('falha depois de a tela trocar de pessoa não avisa (era o erro preso na DM seguinte)', async () => {
    const d = deps({ get: vi.fn().mockRejectedValue(new Error('x')), isCancelled: () => true })
    await openDm('ana', d)
    expect(d.onFailed).not.toHaveBeenCalled()
  })
})
