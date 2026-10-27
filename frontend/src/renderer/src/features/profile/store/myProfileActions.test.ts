import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }))
vi.mock('../../auth/store/authStore', () => ({ useAuthStore: { getState: () => state } }))
const commitMe = vi.hoisted(() => vi.fn())
vi.mock('../../auth/store/accountActions', () => ({ commitMe }))
const updateProfile = vi.hoisted(() => vi.fn(async (fields: Record<string, unknown>) => ({ id: 'u1', ...fields })))
vi.mock('../api/users', () => ({ updateProfile }))

import { saveMyProfileFields } from './myProfileActions'

beforeEach(() => {
  state.user = { id: 'u1', username: 'ana', display_name: 'Ana', pronouns: 'ela', bio: 'oi' }
  updateProfile.mockClear()
  commitMe.mockClear()
})

describe('saveMyProfileFields', () => {
  it('manda o perfil salvo com a mudança por cima e grava a resposta', async () => {
    await saveMyProfileFields({ display_name: '  Aninha ' })
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'Aninha', pronouns: 'ela', bio: 'oi' })
    )
    expect(commitMe).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Aninha' }))
  })
  it('sem sessão não faz nada', async () => {
    state.user = null
    await saveMyProfileFields({ display_name: 'X' })
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
