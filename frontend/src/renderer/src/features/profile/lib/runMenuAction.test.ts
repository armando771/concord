import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/store/toastStore', () => ({
  showToast: { error: vi.fn(), success: vi.fn() }
}))

import { showToast } from '../../../shared/store/toastStore'
import { runMenuAction, toggleMemberRole } from './runMenuAction'

beforeEach(() => vi.clearAllMocks())

describe('runMenuAction', () => {
  it('liga e desliga o "salvando" em volta da ação e chama onSuccess', async () => {
    const setSaving = vi.fn()
    const onSuccess = vi.fn()
    await runMenuAction({ setSaving, action: async () => {}, fallback: 'falhou', onSuccess })
    expect(setSaving.mock.calls).toEqual([[true], [false]])
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('funciona sem onSuccess (o menu continua aberto)', async () => {
    const setSaving = vi.fn()
    await runMenuAction({ setSaving, action: async () => {}, fallback: 'falhou' })
    expect(setSaving).toHaveBeenLastCalledWith(false)
    expect(showToast.error).not.toHaveBeenCalled()
  })

  it('mostra o erro, não chama onSuccess e ainda desliga o "salvando"', async () => {
    const setSaving = vi.fn()
    const onSuccess = vi.fn()
    await runMenuAction({
      setSaving,
      action: async () => {
        throw new Error('sem permissão')
      },
      fallback: 'falhou',
      onSuccess
    })
    expect(showToast.error).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(setSaving).toHaveBeenLastCalledWith(false)
  })
})

describe('toggleMemberRole', () => {
  const add = vi.fn().mockResolvedValue(undefined)
  const remove = vi.fn().mockResolvedValue(undefined)

  it('remove o cargo que a pessoa tem', async () => {
    await toggleMemberRole({ has: true, serverId: 's1', userId: 'u1', roleId: 'r1', add, remove })
    expect(remove).toHaveBeenCalledWith('s1', 'u1', 'r1')
    expect(add).not.toHaveBeenCalled()
  })

  it('atribui o cargo que a pessoa não tem', async () => {
    await toggleMemberRole({ has: false, serverId: 's1', userId: 'u1', roleId: 'r1', add, remove })
    expect(add).toHaveBeenCalledWith('s1', 'u1', 'r1')
  })
})
