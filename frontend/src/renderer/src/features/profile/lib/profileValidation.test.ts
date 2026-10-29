import { describe, expect, it } from 'vitest'
import { DEFAULT_NAME_STYLE } from './nameStyle'
import { DEFAULT_PROFILE_THEME } from './profileTheme'
import { DEFAULT_EXTRAS } from './profileThemeExtras'
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
    for (const bad of ['\u{200b}', 'a\u{0}b', 'a\u{202e}b', '\u{2800}', 'a\tb']) {
      expect(
        profileErrors({ ...saved(), display_name: bad }).display_name,
        JSON.stringify(bad)
      ).toBe('Sem caracteres invisíveis ou de controle.')
    }
    expect(profileErrors({ ...saved(), display_name: '👩🏽\u{200d}💻' }).display_name).toBeUndefined()
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

describe('estilo do nome no rascunho', () => {
  it('rascunho vem com o estilo salvo, ou o padrão', () => {
    expect(draftFromProfile({ display_name: 'a' }).name_style).toEqual(DEFAULT_NAME_STYLE)
    const style = { font: 'tempo', effect: 'neon', colors: ['#00ffaa'] }
    expect(draftFromProfile({ display_name: 'a', name_style: style }).name_style).toEqual(style)
  })

  it('estilo inválido do servidor vira o padrão', () => {
    const draft = draftFromProfile({
      display_name: 'a',
      name_style: { font: 'nope', effect: 'nope', colors: ['x'] }
    })
    expect(draft.name_style).toEqual(DEFAULT_NAME_STYLE)
  })

  it('mudar só o estilo deixa o perfil sujo e vai no payload', () => {
    const edited = { ...saved(), name_style: { font: 'bit8', effect: 'solid', colors: [] } }
    expect(isDirty(edited, saved())).toBe(true)
    expect(profilePayload(edited).name_style).toEqual(edited.name_style)
  })
})

describe('tema do perfil no rascunho', () => {
  const theme = {
    border: 'neon',
    border_colors: ['#00ffaa'],
    background: 'gradient',
    background_colors: ['#1e1b4b', '#0f172a'],
    effect: 'snow',
    ...DEFAULT_EXTRAS
  }

  it('mudar só uma opção fina (ex.: textura) também deixa o perfil sujo', () => {
    const edited = { ...saved(), profile_theme: { ...DEFAULT_PROFILE_THEME, texture: 'grain' } }
    expect(isDirty(edited, saved())).toBe(true)
    expect(profilePayload(edited).profile_theme.texture).toBe('grain')
  })

  it('rascunho vem com o tema salvo, ou o padrão', () => {
    expect(draftFromProfile({ display_name: 'a' }).profile_theme).toEqual(DEFAULT_PROFILE_THEME)
    expect(draftFromProfile({ display_name: 'a', profile_theme: theme }).profile_theme).toEqual(
      theme
    )
  })

  it('mudar só o tema deixa o perfil sujo e vai no payload', () => {
    const edited = { ...saved(), profile_theme: theme }
    expect(isDirty(edited, saved())).toBe(true)
    expect(profilePayload(edited).profile_theme).toEqual(theme)
    expect(isDirty(saved(), saved())).toBe(false)
  })

  it('tema inválido no rascunho sai resolvido no payload', () => {
    const edited = { ...saved(), profile_theme: { ...theme, border_colors: ['url(x)'] } }
    expect(profilePayload(edited).profile_theme.border).toBe('none')
  })
})
