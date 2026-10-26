import { beforeEach, describe, expect, it } from 'vitest'
import { roomValue } from '../lib/roomState'
import { useDraftStore } from './draftStore'

const draftOf = (room: string): string => roomValue(useDraftStore.getState().byRoom, room, '')

describe('draftStore', () => {
  beforeEach(() => {
    useDraftStore.getState().clear()
  })

  it('o texto digitado numa sala não aparece em outra (regressão: ia para a DM/canal errado)', () => {
    useDraftStore.getState().update('conversation:ana', 'segredo para a Ana')
    expect(draftOf('conversation:ana')).toBe('segredo para a Ana')
    expect(draftOf('conversation:bia')).toBe('')
    expect(draftOf('channel:geral')).toBe('')
  })

  it('cada sala guarda o seu rascunho e ele volta ao reabrir', () => {
    useDraftStore.getState().update('channel:a', 'um')
    useDraftStore.getState().update('channel:b', 'dois')
    expect(draftOf('channel:a')).toBe('um')
    expect(draftOf('channel:b')).toBe('dois')
  })

  it('aceita função (emoji no fim do que já está na sala)', () => {
    useDraftStore.getState().update('channel:a', 'oi')
    useDraftStore.getState().update('channel:a', (prev) => prev + ' 🙂')
    expect(draftOf('channel:a')).toBe('oi 🙂')
  })

  it('enviar (campo vazio) tira a sala do mapa', () => {
    useDraftStore.getState().update('channel:a', 'oi')
    useDraftStore.getState().update('channel:a', '')
    expect(useDraftStore.getState().byRoom).toEqual({})
  })

  it('clear apaga todos (ao sair da conta)', () => {
    useDraftStore.getState().update('channel:a', 'oi')
    useDraftStore.getState().update('channel:b', 'tchau')
    useDraftStore.getState().clear()
    expect(useDraftStore.getState().byRoom).toEqual({})
  })
})
