import { beforeEach, describe, expect, it, vi } from 'vitest'

// No render de servidor o zustand devolve sempre o estado inicial; os mocks
// deixam cada teste escolher o estado.
const state = vi.hoisted(() => ({
  auth: { user: { entrance_sound_url: null as string | null } },
  sound: {
    busy: null as 'upload' | 'remove' | null,
    error: null as string | null,
    pick: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (sel: (s: typeof state.auth) => unknown) => sel(state.auth)
}))
vi.mock('../store/entranceSoundStore', () => ({
  useEntranceSoundStore: (sel: (s: typeof state.sound) => unknown) => sel(state.sound)
}))
// A prévia toca pelo áudio da call (não existe no node).
vi.mock('../../call/lib/entranceSoundStart', () => ({ previewJoinSound: vi.fn() }))

import { renderToStaticMarkup } from 'react-dom/server'
import EntranceSoundSettings from './EntranceSoundSettings'

const render = (): string => renderToStaticMarkup(<EntranceSoundSettings />)

beforeEach(() => {
  state.auth.user.entrance_sound_url = null
  state.sound.busy = null
  state.sound.error = null
})

describe('EntranceSoundSettings', () => {
  it('sem som: escolher e ouvir o padrão, sem "usar o padrão"', () => {
    const html = render()
    expect(html).toContain('Toca para quem já está na call')
    expect(html).toContain('Escolher som')
    expect(html).toContain('Ouvir')
    expect(html).toContain('Usando o som padrão.')
    expect(html).not.toContain('Usar o som padrão')
  })

  it('com som: trocar e voltar ao padrão', () => {
    state.auth.user.entrance_sound_url = '/api/entrance-sounds/x'
    const html = render()
    expect(html).toContain('Trocar som')
    expect(html).toContain('Usar o som padrão')
    expect(html).toContain('Usando o seu som.')
  })

  it('enviando: botões travados; erro aparece', () => {
    state.sound.busy = 'upload'
    state.sound.error = 'O som de entrada pode ter até 2 MB.'
    const html = render()
    expect(html).toContain('Enviando…')
    expect(html).toContain('disabled=""')
    expect(html).toContain('O som de entrada pode ter até 2 MB.')
  })
})
