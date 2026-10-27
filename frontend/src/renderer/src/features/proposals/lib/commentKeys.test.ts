import { describe, expect, it } from 'vitest'
import { commentEditKeyAction, commentSaveDisabled } from './commentKeys'

describe('commentEditKeyAction', () => {
  it('Enter salva a edição', () => {
    expect(commentEditKeyAction('Enter', false)).toBe('save')
  })

  it('Shift+Enter quebra a linha (não faz nada)', () => {
    expect(commentEditKeyAction('Enter', true)).toBeNull()
  })

  it('Esc cancela a edição (e quem chama marca o evento, para o modal não fechar junto)', () => {
    expect(commentEditKeyAction('Escape', false)).toBe('cancel')
  })

  it('as outras teclas seguem normais', () => {
    expect(commentEditKeyAction('a', false)).toBeNull()
    expect(commentEditKeyAction('Tab', false)).toBeNull()
  })
})

describe('commentSaveDisabled', () => {
  it('com texto e livre, dá para salvar', () => {
    expect(commentSaveDisabled('oi', false, false)).toBe(false)
  })

  it('enquanto salva, não', () => {
    expect(commentSaveDisabled('oi', false, true)).toBe(true)
  })

  it('texto vazio ou só espaços não salva, a não ser que haja anexo', () => {
    expect(commentSaveDisabled('   ', false, false)).toBe(true)
    expect(commentSaveDisabled('   ', true, false)).toBe(false)
  })
})
