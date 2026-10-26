import { describe, expect, it } from 'vitest'
import { filterPeople, matchesPerson } from './personFilter'

const ana = { username: 'ana99', display_name: 'Ana Souza' }
const bia = { username: 'bia' }

describe('matchesPerson', () => {
  it('busca vazia deixa todo mundo', () => {
    expect(matchesPerson(ana, '')).toBe(true)
    expect(matchesPerson(ana, '   ')).toBe(true)
  })
  it('acha pelo nome de usuário, sem diferenciar maiúsculas', () => {
    expect(matchesPerson(ana, 'ANA9')).toBe(true)
  })
  it('acha pelo nome de exibição', () => {
    expect(matchesPerson(ana, 'souza')).toBe(true)
  })
  it('não acha quem não bate; sem nome de exibição não quebra', () => {
    expect(matchesPerson(bia, 'souza')).toBe(false)
    expect(matchesPerson(bia, 'bi')).toBe(true)
  })
})

describe('filterPeople', () => {
  it('filtra a lista', () => {
    expect(filterPeople([ana, bia], 'bia')).toEqual([bia])
  })
})
