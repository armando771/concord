import { describe, expect, it, vi } from 'vitest'
import { runCreateServer, runJoinServer, type ServerFlowDeps } from './serverFlows'

function makeDeps(over: Partial<ServerFlowDeps> = {}): ServerFlowDeps {
  return {
    addServer: vi.fn().mockResolvedValue({ id: 's1', name: 'Brothers' }),
    setServerIcon: vi.fn().mockResolvedValue(undefined),
    joinServerByCode: vi.fn().mockResolvedValue({ id: 's2', name: 'Outro' }),
    fetchServers: vi.fn().mockResolvedValue(undefined),
    success: vi.fn(),
    error: vi.fn(),
    ...over
  }
}

const icon = { kind: 'set', file: new Blob(), staticFrame: null } as never

describe('runCreateServer', () => {
  it('cria sem ícone e avisa o sucesso', async () => {
    const deps = makeDeps()
    expect(await runCreateServer(deps, 'Brothers', { kind: 'keep' })).toBe('s1')
    expect(deps.setServerIcon).not.toHaveBeenCalled()
    expect(deps.success).toHaveBeenCalledWith('Servidor "Brothers" criado com sucesso!')
  })

  it('envia o ícone escolhido', async () => {
    const deps = makeDeps()
    await runCreateServer(deps, 'Brothers', icon)
    expect(deps.setServerIcon).toHaveBeenCalledWith('s1', expect.anything())
  })

  it('falha no ícone avisa, mas o servidor continua criado', async () => {
    const deps = makeDeps({ setServerIcon: vi.fn().mockRejectedValue(new Error('arquivo grande')) })
    expect(await runCreateServer(deps, 'Brothers', icon)).toBe('s1')
    expect(deps.error).toHaveBeenCalledWith('arquivo grande')
    expect(deps.success).toHaveBeenCalled()
  })

  it('falha ao criar devolve null e mostra a mensagem', async () => {
    const deps = makeDeps({ addServer: vi.fn().mockRejectedValue('x') })
    expect(await runCreateServer(deps, 'Brothers', { kind: 'keep' })).toBeNull()
    expect(deps.error).toHaveBeenCalledWith('Falha ao criar servidor.')
  })
})

describe('runJoinServer', () => {
  it('entra pelo link colado inteiro e recarrega a lista', async () => {
    const deps = makeDeps()
    expect(await runJoinServer(deps, 'https://app-salinha.bhrx.com.br/convite/K7P2QX9M')).toBe('s2')
    expect(deps.joinServerByCode).toHaveBeenCalledWith('K7P2QX9M')
    expect(deps.fetchServers).toHaveBeenCalled()
    expect(deps.success).toHaveBeenCalledWith('Você entrou em "Outro"!')
  })

  it('código inválido não chama a API', async () => {
    const deps = makeDeps()
    expect(await runJoinServer(deps, '   ')).toBeNull()
    expect(deps.joinServerByCode).not.toHaveBeenCalled()
    expect(deps.error).toHaveBeenCalledWith('Link ou código de convite inválido.')
  })

  it('erro da API vira aviso', async () => {
    const deps = makeDeps({ joinServerByCode: vi.fn().mockRejectedValue(new Error('expirado')) })
    expect(await runJoinServer(deps, 'K7P2QX9M')).toBeNull()
    expect(deps.error).toHaveBeenCalledWith('expirado')
  })
})
