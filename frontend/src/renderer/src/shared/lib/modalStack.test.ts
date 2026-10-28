import { describe, expect, it } from 'vitest'
import { createModalStack } from './modalStack'

describe('createModalStack', () => {
  it('sem nenhum aberto, ninguém é o do topo', () => {
    expect(createModalStack().isTop('a')).toBe(false)
  })

  it('o último aberto é o do topo', () => {
    const stack = createModalStack()
    stack.push('a')
    stack.push('b')
    expect(stack.isTop('b')).toBe(true)
    expect(stack.isTop('a')).toBe(false)
  })

  it('ao fechar o do topo, o de baixo volta a ser o do topo', () => {
    const stack = createModalStack()
    stack.push('a')
    stack.push('b')
    stack.remove('b')
    expect(stack.isTop('a')).toBe(true)
  })

  it('fechar um do meio não muda quem está no topo', () => {
    const stack = createModalStack()
    ;['a', 'b', 'c'].forEach(stack.push)
    stack.remove('b')
    expect(stack.isTop('c')).toBe(true)
  })

  it('remover quem não está na pilha não faz nada', () => {
    const stack = createModalStack()
    stack.push('a')
    stack.remove('x')
    expect(stack.isTop('a')).toBe(true)
  })
})

describe('hasOpen', () => {
  it('diz se há algum modal aberto', () => {
    const stack = createModalStack()
    expect(stack.hasOpen()).toBe(false)
    stack.push('a')
    expect(stack.hasOpen()).toBe(true)
    stack.remove('a')
    expect(stack.hasOpen()).toBe(false)
  })
})
