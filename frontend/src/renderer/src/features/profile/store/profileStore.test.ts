import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicProfile } from '../api/users'

const getProfile = vi.fn<(id: string) => Promise<PublicProfile>>()
vi.mock('../api/users', () => ({ getProfile: (id: string) => getProfile(id) }))

const { useProfileStore } = await import('./profileStore')

const profile = (over: Partial<PublicProfile> = {}): PublicProfile => ({
  id: 'u1',
  username: 'mugis',
  display_name: 'Mugis',
  pronouns: '',
  bio: '',
  status_text: '',
  links: [],
  status: 'online',
  created_at: '2026-10-24T00:00:00Z',
  ...over
})

beforeEach(() => {
  useProfileStore.getState().reset()
  getProfile.mockReset()
})

describe('profileStore', () => {
  it('apply troca o perfil pelo mais novo', () => {
    useProfileStore.getState().apply(profile())
    useProfileStore.getState().apply(profile({ display_name: 'Mugis RX', avatar_url: '/a' }))
    expect(useProfileStore.getState().profiles.u1).toMatchObject({
      display_name: 'Mugis RX',
      avatar_url: '/a'
    })
  })

  it('dois pedidos ao mesmo tempo fazem uma requisição só', async () => {
    getProfile.mockResolvedValue(profile())
    const [a, b] = await Promise.all([
      useProfileStore.getState().fetchProfile('u1'),
      useProfileStore.getState().fetchProfile('u1')
    ])
    expect(getProfile).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
  })

  it('perfil recente vem do cache; force busca de novo', async () => {
    getProfile.mockResolvedValue(profile())
    await useProfileStore.getState().fetchProfile('u1')
    await useProfileStore.getState().fetchProfile('u1')
    expect(getProfile).toHaveBeenCalledTimes(1)
    await useProfileStore.getState().fetchProfile('u1', { force: true })
    expect(getProfile).toHaveBeenCalledTimes(2)
  })

  it('erro na busca não derruba o que já estava salvo', async () => {
    useProfileStore.getState().apply(profile())
    useProfileStore.setState({ fetchedAt: { u1: 0 } })
    getProfile.mockRejectedValue(new Error('offline'))
    const result = await useProfileStore.getState().fetchProfile('u1')
    expect(result?.display_name).toBe('Mugis')
  })
})
