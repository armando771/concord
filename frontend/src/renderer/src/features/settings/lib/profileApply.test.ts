import { describe, expect, it, vi } from 'vitest'
import type { User } from '../../auth/store/authStore'
import { applyProfileChange, draftWithChange, type ApplyDeps } from './profileApply'

const user = (over: Partial<User> = {}): User =>
  ({
    id: 'u1',
    username: 'ana',
    display_name: 'Ana',
    email: 'a@x.com',
    bio: 'oi',
    links: [{ url: 'https://github.com/ana' }],
    ...over
  }) as unknown as User

function setup(saved = user()): { deps: ApplyDeps; notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } } {
  let current = saved
  const deps: ApplyDeps = {
    savedUser: () => current,
    upload: vi.fn(async () => user({ avatar_url: '/novo.png' })),
    remove: vi.fn(async () => user({ banner_url: null })),
    update: vi.fn(async (f) => user({ display_name: f.display_name, pronouns: f.pronouns })),
    commit: vi.fn((u: User) => {
      current = u
    }),
    setProgress: vi.fn()
  }
  return { deps, notify: { success: vi.fn(), error: vi.fn() } }
}

describe('draftWithChange', () => {
  it('parte do salvo e põe só a mudança por cima', () => {
    const draft = draftWithChange(user(), { fields: { pronouns: 'ela/dela' } })
    expect(draft.pronouns).toBe('ela/dela')
    expect(draft.bio).toBe('oi')
    expect(draft.links).toEqual(['https://github.com/ana'])
    expect(draft.avatar).toEqual({ kind: 'keep' })
  })
  it('avatar e banner entram como mudança de mídia', () => {
    const draft = draftWithChange(user(), { avatar: { kind: 'remove' }, banner: { kind: 'remove' } })
    expect(draft.avatar).toEqual({ kind: 'remove' })
    expect(draft.banner).toEqual({ kind: 'remove' })
  })
  it('sem usuário: o rascunho vazio', () => {
    expect(draftWithChange(null, {}).display_name).toBe('')
  })
})

describe('applyProfileChange', () => {
  it('campo de texto: salva na hora, grava a sessão e avisa', async () => {
    const { deps, notify } = setup()
    const ok = await applyProfileChange({ fields: { pronouns: 'ela/dela' } }, deps, notify)
    expect(ok).toBe(true)
    expect(deps.update).toHaveBeenCalledWith(expect.objectContaining({ pronouns: 'ela/dela', bio: 'oi' }))
    expect(deps.commit).toHaveBeenCalled()
    expect(notify.success).toHaveBeenCalledWith('Perfil salvo!')
  })

  it('só o avatar: envia a imagem e não regrava os campos', async () => {
    const { deps, notify } = setup()
    const file = new Blob(['x'])
    const ok = await applyProfileChange(
      { avatar: { kind: 'set', file, previewUrl: 'blob:1', animated: false } },
      deps,
      notify
    )
    expect(ok).toBe(true)
    expect(deps.upload).toHaveBeenCalledWith('avatar', file, undefined, deps.setProgress)
    expect(deps.update).not.toHaveBeenCalled()
  })

  it('remover o banner chama o DELETE', async () => {
    const { deps, notify } = setup()
    await applyProfileChange({ banner: { kind: 'remove' } }, deps, notify)
    expect(deps.remove).toHaveBeenCalledWith('banner')
  })

  it('nada mudou: não chama o servidor, mas confirma', async () => {
    const { deps, notify } = setup()
    const ok = await applyProfileChange({ fields: { bio: 'oi' } }, deps, notify)
    expect(ok).toBe(true)
    expect(deps.update).not.toHaveBeenCalled()
  })

  it('erro do servidor: devolve false e mostra a mensagem', async () => {
    const { deps, notify } = setup()
    deps.update = vi.fn(async () => {
      throw new Error('Nome inválido.')
    })
    const ok = await applyProfileChange({ fields: { display_name: 'X' } }, deps, notify)
    expect(ok).toBe(false)
    expect(notify.error).toHaveBeenCalledWith('Nome inválido.')
    expect(notify.success).not.toHaveBeenCalled()
  })
})
