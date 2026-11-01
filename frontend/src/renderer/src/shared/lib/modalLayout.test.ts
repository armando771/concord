import { describe, expect, it } from 'vitest'
import { modalLayout } from './modalLayout'

describe('modalLayout', () => {
  it('a largura segue wide e xl', () => {
    expect(modalLayout({}).dialog).toContain('max-w-md')
    expect(modalLayout({ wide: true }).dialog).toContain('max-w-3xl')
    expect(modalLayout({ xl: true }).dialog).toContain('max-w-5xl')
  })

  it('o modal pequeno vira folha de baixo no celular', () => {
    const { backdrop, dialog } = modalLayout({})
    expect(backdrop).toContain('max-sm:items-end')
    expect(backdrop).toContain('max-sm:p-0')
    expect(dialog).toContain('max-sm:rounded-b-none')
    expect(dialog).toContain('max-sm:animate-sheet-in')
  })

  it('o largo (editores) ocupa a tela inteira abaixo do md', () => {
    for (const opts of [{ wide: true }, { xl: true }]) {
      const { backdrop, dialog } = modalLayout(opts)
      expect(backdrop).toContain('max-md:p-0')
      expect(dialog).toContain('max-md:h-full')
      expect(dialog).toContain('max-md:rounded-none')
    }
  })

  it('no desktop continua centralizado, com margem e cantos redondos', () => {
    const { backdrop, dialog } = modalLayout({})
    expect(backdrop).toMatch(/(^|\s)items-center(\s|$)/)
    expect(backdrop).toMatch(/(^|\s)p-4(\s|$)/)
    expect(dialog).toMatch(/(^|\s)rounded-2xl(\s|$)/)
  })
})
