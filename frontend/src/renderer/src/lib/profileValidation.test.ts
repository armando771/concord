import { describe, expect, it } from 'vitest'
import {
  draftFromProfile,
  hasErrors,
  imageFileError,
  isDirty,
  profileErrors,
  profilePayload,
  type ProfileDraft
} from './profileValidation'

const saved = (): ProfileDraft =>
  draftFromProfile({
    display_name: 'Mugis',
    pronouns: '',
    bio: 'oi',
    status_text: '',
    banner_color: null,
    links: [{ url: 'https://twitch.tv/mugis_rx' }]
  })

describe('draftFromProfile', () => {
  it('aceita links no formato do backend ({url})', () => {
    expect(saved().links).toEqual(['https://twitch.tv/mugis_rx'])
  })

  it('perfil sem nada vira rascunho vazio', () => {
    const draft = draftFromProfile({})
    expect(draft.links).toEqual([])
    expect(draft.avatar).toEqual({ kind: 'keep' })
  })
})

describe('profileErrors', () => {
  it('perfil válido não tem erro', () => {
    expect(hasErrors(profileErrors(saved()))).toBe(false)
  })

  it('nome vazio ou com 33 caracteres', () => {
    expect(profileErrors({ ...saved(), display_name: '  ' }).display_name).toBeTruthy()
    expect(profileErrors({ ...saved(), display_name: 'a'.repeat(33) }).display_name).toBeTruthy()
    expect(profileErrors({ ...saved(), display_name: 'a'.repeat(32) }).display_name).toBeUndefined()
  })

  it('bio conta caracteres, não bytes', () => {
    expect(profileErrors({ ...saved(), bio: 'ç'.repeat(189) + '🎮' }).bio).toBeUndefined()
    expect(profileErrors({ ...saved(), bio: 'a'.repeat(191) }).bio).toBeTruthy()
  })

  it('pronomes, nota e cor', () => {
    expect(profileErrors({ ...saved(), pronouns: 'a'.repeat(41) }).pronouns).toBeTruthy()
    expect(profileErrors({ ...saved(), status_text: 'a'.repeat(129) }).status_text).toBeTruthy()
    expect(profileErrors({ ...saved(), banner_color: 'red' }).banner_color).toBeTruthy()
    expect(profileErrors({ ...saved(), banner_color: '#A1b2C3' }).banner_color).toBeUndefined()
  })

  it('erro por link, na posição certa', () => {
    const errors = profileErrors({
      ...saved(),
      links: ['twitch.tv/mugis', 'javascript:alert(1)', 'https://TWITCH.tv/mugis']
    })
    expect(errors.linkErrors?.[0]).toBeNull()
    expect(errors.linkErrors?.[1]).toBeTruthy()
    expect(errors.linkErrors?.[2]).toMatch(/já está/)
    expect(hasErrors(errors)).toBe(true)
  })

  it('mais de 5 links', () => {
    const links = Array.from({ length: 6 }, (_, i) => `https://site.com/${i}`)
    expect(profileErrors({ ...saved(), links }).links).toBeTruthy()
  })
})

describe('profilePayload', () => {
  it('tira espaços e completa os links', () => {
    expect(
      profilePayload({ ...saved(), display_name: ' Mugis ', links: [' steamcommunity.com/id/x '] })
    ).toMatchObject({ display_name: 'Mugis', links: ['https://steamcommunity.com/id/x'] })
  })
})

describe('isDirty', () => {
  it('sem mudança não mostra a barra', () => {
    expect(isDirty(saved(), saved())).toBe(false)
  })

  it('mudança só de espaços não conta', () => {
    expect(isDirty({ ...saved(), bio: ' oi ' }, saved())).toBe(false)
  })

  it('editar um link, a cor ou trocar a foto conta', () => {
    expect(isDirty({ ...saved(), links: ['https://twitch.tv/outro'] }, saved())).toBe(true)
    expect(isDirty({ ...saved(), banner_color: '#5865f2' }, saved())).toBe(true)
    expect(isDirty({ ...saved(), avatar: { kind: 'remove' } }, saved())).toBe(true)
  })

  it('depois de "Redefinir" volta a ficar limpo', () => {
    const edited = { ...saved(), display_name: 'Outro' }
    expect(isDirty(edited, saved())).toBe(true)
    expect(isDirty({ ...saved() }, saved())).toBe(false)
  })
})

describe('imageFileError', () => {
  it('aceita imagens até 10 MB, GIF incluso', () => {
    expect(imageFileError({ type: 'image/gif', size: 10 * 1024 * 1024 })).toBeNull()
    expect(imageFileError({ type: 'image/png', size: 1000 })).toBeNull()
  })

  it('recusa outros tipos e arquivos grandes', () => {
    expect(imageFileError({ type: 'application/pdf', size: 1000 })).toBeTruthy()
    expect(imageFileError({ type: 'image/png', size: 12 * 1024 * 1024 })).toBeTruthy()
  })
})
