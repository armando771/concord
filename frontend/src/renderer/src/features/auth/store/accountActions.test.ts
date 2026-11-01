import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  setUser: vi.fn((u: Record<string, unknown>) => {
    state.user = u
  })
}))
vi.mock('./authStore', () => ({ useAuthStore: { getState: () => state } }))
const api = vi.hoisted(() => ({
  changeUsername: vi.fn(async (username: string) => ({ id: 'u1', username, status: 'online' })),
  changeEmail: vi.fn(async (email: string) => ({ id: 'u1', email, email_verified: false }))
}))
vi.mock('../api/account', () => api)

import { changeMyEmail, changeMyUsername, commitMe } from './accountActions'

beforeEach(() => {
  state.user = { id: 'u1', username: 'ana', email: 'a@x.com', status: 'dnd' }
  state.setUser.mockClear()
})

describe('accountActions', () => {
  it('commitMe mantém o status escolhido nesta sessão', () => {
    commitMe({ id: 'u1', status: 'online' } as never)
    expect(state.user).toEqual({ id: 'u1', status: 'dnd' })
  })
  it('sem sessão, usa o status da resposta', () => {
    state.user = null
    commitMe({ id: 'u1', status: 'online' } as never)
    expect(state.user).toEqual({ id: 'u1', status: 'online' })
  })
  it('trocar o @ grava a conta que voltou', async () => {
    await changeMyUsername('ana_2', 'senha')
    expect(api.changeUsername).toHaveBeenCalledWith('ana_2', 'senha')
    expect(state.user).toMatchObject({ username: 'ana_2', status: 'dnd' })
  })
  it('trocar o e-mail grava a conta (agora não confirmada)', async () => {
    await changeMyEmail('b@x.com', 'senha')
    expect(state.user).toMatchObject({ email: 'b@x.com', email_verified: false })
  })
})
