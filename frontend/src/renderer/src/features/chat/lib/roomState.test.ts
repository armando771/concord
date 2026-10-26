import { describe, expect, it } from 'vitest'
import { roomUpdate, roomValue } from './roomState'

describe('roomValue', () => {
  it('devolve o valor da sala, ou o inicial se ela não tem', () => {
    expect(roomValue({ a: 'oi' }, 'a', '')).toBe('oi')
    expect(roomValue({ a: 'oi' }, 'b', '')).toBe('')
  })

  it('valor guardado que é falso ainda vale (não cai no inicial)', () => {
    expect(roomValue({ a: 0 }, 'a', 5)).toBe(0)
  })
})

describe('roomUpdate', () => {
  it('grava só na sala pedida', () => {
    const next = roomUpdate({}, 'a', '', 'oi')
    expect(next).toEqual({ a: 'oi' })
    expect(roomValue(next, 'b', '')).toBe('')
  })

  it('aceita função, que recebe o valor da própria sala', () => {
    const map = { a: 'x', b: 'y' }
    expect(roomUpdate(map, 'a', '', (prev) => prev + '!')).toEqual({ a: 'x!', b: 'y' })
    expect(roomUpdate(map, 'c', '', (prev) => prev + '!')).toEqual({ a: 'x', b: 'y', c: '!' })
  })

  it('voltar ao valor inicial remove a entrada (o mapa não cresce)', () => {
    expect(roomUpdate({ a: 'oi', b: 'x' }, 'a', '', '')).toEqual({ b: 'x' })
  })

  it('sem mudança devolve o mesmo mapa (não renderiza à toa)', () => {
    const map = { a: 'oi' }
    expect(roomUpdate(map, 'a', '', 'oi')).toBe(map)
    expect(roomUpdate(map, 'z', '', '')).toBe(map)
  })

  it('serve para booleano e para nulo (sending, menção)', () => {
    expect(roomUpdate({}, 'a', false, true)).toEqual({ a: true })
    expect(roomUpdate({ a: true }, 'a', false, false)).toEqual({})
    expect(roomUpdate({}, 'a', null as { q: string } | null, { q: 'x' })).toEqual({ a: { q: 'x' } })
  })
})
