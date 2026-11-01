import { describe, expect, it } from 'vitest'
import { filterSwitcherItems, type SwitcherItem } from './quickSwitcher'

const item = (kind: SwitcherItem['kind'], label: string, hint = ''): SwitcherItem => ({
  key: `${kind}:${label}`,
  kind,
  label,
  hint,
  route: '/'
})

const items = [
  item('person', 'Ana', 'ana01'),
  item('server', 'Brothers', 'Servidor'),
  item('channel', '#geral', 'Brothers'),
  item('channel', '#anuncios', 'Brothers')
]

const labels = (list: SwitcherItem[]): string[] => list.map((i) => i.label)

describe('filterSwitcherItems', () => {
  it('sem texto esconde os canais', () => {
    expect(labels(filterSwitcherItems(items, ''))).toEqual(['Ana', 'Brothers'])
  })

  it('com texto busca em todos pelo nome e pelo detalhe', () => {
    expect(labels(filterSwitcherItems(items, 'bro'))).toEqual(['Brothers', '#geral', '#anuncios'])
    expect(labels(filterSwitcherItems(items, 'ana01'))).toEqual(['Ana'])
  })

  it('prefixos limitam o tipo', () => {
    expect(labels(filterSwitcherItems(items, '@'))).toEqual(['Ana'])
    expect(labels(filterSwitcherItems(items, '*'))).toEqual(['Brothers'])
    expect(labels(filterSwitcherItems(items, '#'))).toEqual(['#geral', '#anuncios'])
  })

  it('prefixo com texto filtra dentro do tipo', () => {
    expect(labels(filterSwitcherItems(items, '#ger'))).toEqual(['#geral'])
    expect(labels(filterSwitcherItems(items, '* bro'))).toEqual(['Brothers'])
    expect(labels(filterSwitcherItems(items, '@bro'))).toEqual([])
  })

  it('ignora maiúsculas', () => {
    expect(labels(filterSwitcherItems(items, 'ANA'))).toEqual(['Ana'])
  })
})
