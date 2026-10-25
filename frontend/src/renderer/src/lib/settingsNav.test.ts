import { describe, expect, it } from 'vitest'
import { SETTINGS_SECTIONS, filterSections } from './settingsNav'

const ids = (query: string): string[] => filterSections(query).map((s) => s.id)

describe('filterSections', () => {
  it('sem busca mostra tudo', () => {
    expect(filterSections('  ')).toHaveLength(SETTINGS_SECTIONS.length)
  })

  it('acha pelo nome da seção', () => {
    expect(ids('perfis')).toEqual(['profiles'])
    expect(ids('voz')).toEqual(['voice'])
  })

  it('acha pelo que tem dentro', () => {
    expect(ids('gif')).toEqual(['profiles'])
    expect(ids('rnnoise')).toEqual(['voice'])
    expect(ids('overlay')).toEqual(['app'])
  })

  it('ignora acento e maiúscula', () => {
    expect(ids('NOTIFICACAO')).toEqual(['notifications'])
    expect(ids('aniversario')).toEqual(['profiles'])
  })

  it('sem resultado volta vazio', () => {
    expect(ids('xyzzy')).toEqual([])
  })
})
