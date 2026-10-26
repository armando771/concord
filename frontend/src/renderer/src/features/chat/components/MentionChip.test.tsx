import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.stubGlobal('window', {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  getSelection: () => null
})

vi.mock('../../../app/router', () => ({
  default: {
    navigate: vi.fn(),
    state: { location: { pathname: '/' } }
  }
}))

vi.mock('../../call/lib/noiseSuppression', () => ({
  openMicrophone: vi.fn()
}))
vi.mock('../../call/lib/rtc', () => ({}))

import { useServerStore } from '../../servers/store/serverStore'
import { useAuthStore } from '../../auth/store/authStore'
import { useProfileCardStore } from '../../profile/store/profileCardStore'
import { useUserMenuStore } from '../../profile/store/userMenuStore'
import { findMentionUserSync, isEveryoneMention, openMentionProfile } from './MentionChip'

describe('MentionChip integração', () => {
  beforeEach(() => {
    useProfileCardStore.setState({ target: null })
    useUserMenuStore.setState({ target: null })
    useAuthStore.setState({
      user: {
        id: 'me-123',
        username: 'me_user',
        display_name: 'Meu Nome',
        email: 'me@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })
    useServerStore.setState({
      currentServer: {
        id: 'srv-1',
        name: 'Servidor Teste',
        owner_id: 'owner-1',
        created_at: new Date().toISOString()
      },
      currentMembers: [
        {
          server_id: 'srv-1',
          user_id: 'user-jamal',
          role: 'member',
          username: 'jamal',
          display_name: 'Jamal Silva',
          nickname: 'Jamal Nick',
          joined_at: new Date().toISOString(),
          role_ids: []
        },
        {
          server_id: 'srv-1',
          user_id: 'user-mugis',
          role: 'member',
          username: 'mugis',
          display_name: 'Mugis',
          nickname: null,
          joined_at: new Date().toISOString(),
          role_ids: []
        }
      ]
    })
  })

  it('reconhece menções em massa como não-usuários', () => {
    expect(isEveryoneMention('all')).toBe(true)
    expect(isEveryoneMention('here')).toBe(true)
    expect(isEveryoneMention('everyone')).toBe(true)
    expect(isEveryoneMention('jamal')).toBe(false)
    expect(isEveryoneMention('mugis')).toBe(false)
  })

  it('encontra membro do servidor pelo username na menção síncrona', () => {
    const user = findMentionUserSync('jamal')
    expect(user).not.toBeNull()
    expect(user?.userId).toBe('user-jamal')
    expect(user?.username).toBe('jamal')
    // Deve preferir o apelido no servidor se existir
    expect(user?.name).toBe('Jamal Nick')

    const mugis = findMentionUserSync('mugis')
    expect(mugis).not.toBeNull()
    expect(mugis?.userId).toBe('user-mugis')
    expect(mugis?.name).toBe('Mugis')
  })

  it('encontra o próprio usuário logado caso seja mencionado', () => {
    const user = findMentionUserSync('me_user')
    expect(user).not.toBeNull()
    expect(user?.userId).toBe('me-123')
    expect(user?.name).toBe('Meu Nome')
  })

  it('ao chamar openMentionProfile, abre o perfil do usuário no profileCardStore', async () => {
    const dummyEl = {
      getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 200, right: 280, width: 80, height: 20 })
    } as unknown as HTMLElement

    await openMentionProfile('jamal', dummyEl)

    const target = useProfileCardStore.getState().target
    expect(target).not.toBeNull()
    expect(target?.userId).toBe('user-jamal')
    expect(target?.username).toBe('jamal')
    expect(target?.name).toBe('Jamal Nick')
    expect(target?.side).toBe('right')
    expect(target?.anchorEl).toBe(dummyEl)
  })

  it('ao clicar novamente na mesma menção, fecha o cartão (comportamento de toggle)', async () => {
    const dummyEl = {
      getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 200, right: 280, width: 80, height: 20 })
    } as unknown as HTMLElement

    // Primeiro clique: abre
    await openMentionProfile('jamal', dummyEl)
    expect(useProfileCardStore.getState().target?.userId).toBe('user-jamal')

    // Segundo clique: fecha
    await openMentionProfile('jamal', dummyEl)
    expect(useProfileCardStore.getState().target).toBeNull()
  })

  it('não abre cartão de perfil para menções @all ou @here', async () => {
    const dummyEl = {
      getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 200, right: 280, width: 80, height: 20 })
    } as unknown as HTMLElement

    await openMentionProfile('all', dummyEl)
    expect(useProfileCardStore.getState().target).toBeNull()

    await openMentionProfile('here', dummyEl)
    expect(useProfileCardStore.getState().target).toBeNull()
  })
})
