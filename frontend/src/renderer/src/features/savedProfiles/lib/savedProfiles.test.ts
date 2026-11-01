import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/client'
import type { User } from '../../auth/store/authStore'
import {
  MAX_SAVED_PROFILES,
  applyStep,
  canSaveMore,
  currentSavedProfileId,
  removeSaved,
  replaceSaved,
  savedProfileError,
  savedProfileNameError,
  submitSavedName,
  suggestSavedName,
  type SavedProfile
} from './savedProfiles'

const me: User = {
  id: 'u1',
  username: 'ana',
  display_name: 'Ana',
  email: 'a@x.com',
  bio: 'oi',
  links: [{ url: 'https://github.com/ana' }],
  banner_color: '#112233',
  avatar_url: '/api/profile-media/a',
  created_at: '',
  updated_at: ''
}

const saved = (over: Partial<SavedProfile> = {}): SavedProfile => ({
  id: 's1',
  name: 'Casual',
  avatar_url: '/api/profile-media/a',
  banner_url: null,
  fields: {
    display_name: 'Ana',
    pronouns: '',
    bio: 'oi',
    status_text: '',
    banner_color: '#112233',
    links: [{ url: 'https://github.com/ana' }],
    name_style: { font: 'default', effect: 'solid', colors: [] }
  },
  created_at: '',
  updated_at: '',
  ...over
})

describe('savedProfileNameError', () => {
  it('pede um nome de 1 a 32 caracteres visíveis', () => {
    expect(savedProfileNameError('  ')).toBe('Dê um nome ao perfil.')
    expect(savedProfileNameError('a'.repeat(33))).toBe('Até 32 caracteres.')
    expect(savedProfileNameError('a​b')).toBe('Sem caracteres invisíveis ou de controle.')
    expect(savedProfileNameError('ç'.repeat(32))).toBeNull()
    expect(savedProfileNameError(' Gamer ')).toBeNull()
  })

  it('não repete o nome de outro perfil salvo (sem diferenciar maiúsculas)', () => {
    const list = [saved()]
    expect(savedProfileNameError('casual ', list)).toBe('Já existe um perfil com esse nome.')
    // Renomear para o próprio nome vale.
    expect(savedProfileNameError('CASUAL', list, 's1')).toBeNull()
  })
})

describe('currentSavedProfileId', () => {
  it('acha o perfil salvo igual ao atual (padrões preenchidos dos dois lados)', () => {
    expect(currentSavedProfileId([saved()], me)).toBe('s1')
  })

  it('qualquer diferença (campo, avatar, banner) não conta como o atual', () => {
    expect(currentSavedProfileId([saved({ avatar_url: null })], me)).toBeNull()
    expect(currentSavedProfileId([saved({ banner_url: '/api/profile-media/b' })], me)).toBeNull()
    expect(
      currentSavedProfileId([saved({ fields: { ...saved().fields, bio: 'tchau' } })], me)
    ).toBeNull()
    expect(
      currentSavedProfileId([saved()], {
        ...me,
        profile_theme: { border: 'rainbow' } as User['profile_theme']
      })
    ).toBeNull()
  })

  it('sem usuário, nenhum', () => {
    expect(currentSavedProfileId([saved()], null)).toBeNull()
  })
})

describe('lista', () => {
  it('limite de perfis salvos', () => {
    const many = Array.from({ length: MAX_SAVED_PROFILES }, (_, i) => saved({ id: String(i) }))
    expect(canSaveMore(many)).toBe(false)
    expect(canSaveMore(many.slice(1))).toBe(true)
  })

  it('sugere "Perfil N" livre', () => {
    expect(suggestSavedName([])).toBe('Perfil 1')
    expect(suggestSavedName([saved({ name: 'perfil 1' }), saved({ name: 'Perfil 3' })])).toBe(
      'Perfil 2'
    )
  })

  it('troca e remove pelo id', () => {
    const list = [saved(), saved({ id: 's2', name: 'B' })]
    expect(replaceSaved(list, saved({ name: 'Novo' })).map((s) => s.name)).toEqual(['Novo', 'B'])
    expect(replaceSaved(list, saved({ id: 's3', name: 'C' })).map((s) => s.id)).toEqual([
      's1',
      's2',
      's3'
    ])
    expect(removeSaved(list, 's1').map((s) => s.id)).toEqual(['s2'])
  })
})

describe('savedProfileError', () => {
  it('mostra a recusa do servidor e esconde o erro interno', () => {
    expect(
      savedProfileError(new ApiError(409, 'já existe um perfil salvo com esse nome'), 'x')
    ).toBe('Já existe um perfil salvo com esse nome')
    expect(savedProfileError(new ApiError(500, 'internal error'), 'Falhou.')).toBe('Falhou.')
    expect(savedProfileError(new ApiError(0, 'Sem conexão com o servidor.'), 'Falhou.')).toBe(
      'Falhou.'
    )
    expect(savedProfileError('?', 'Falhou.')).toBe('Falhou.')
  })
})

describe('applyStep', () => {
  it('confirma só quando o perfil de agora não está salvo', () => {
    expect(applyStep('a', null, false)).toBe('confirm')
    expect(applyStep('a', 'b', false)).toBe('apply')
    expect(applyStep('a', 'a', false)).toBe('skip')
    expect(applyStep('a', 'b', true)).toBe('skip')
  })
})

describe('submitSavedName', () => {
  it('só envia nome válido e sem outra ação em andamento', async () => {
    const send = vi.fn(async () => true)
    expect(await submitSavedName('A', 'erro', false, send)).toBe(false)
    expect(await submitSavedName('A', null, true, send)).toBe(false)
    expect(send).not.toHaveBeenCalled()
    expect(await submitSavedName('A', null, false, send)).toBe(true)
    expect(send).toHaveBeenCalledWith('A')
  })
})
