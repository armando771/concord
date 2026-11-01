import { describe, expect, it } from 'vitest'
import { dmFailed, dmOpened, dmOpenedFor } from './dmOpened'

describe('dmOpenedFor', () => {
  it('devolve a conversa aberta para a mesma pessoa', () => {
    expect(dmOpenedFor(dmOpened('ana', 'c-ana'), 'ana')).toEqual({
      conversationId: 'c-ana',
      error: null
    })
  })

  it('ao trocar de pessoa não devolve a conversa da anterior (regressão: DM da Bia mostrava a da Ana)', () => {
    expect(dmOpenedFor(dmOpened('ana', 'c-ana'), 'bia')).toEqual({
      conversationId: null,
      error: null
    })
  })

  it('o erro de uma pessoa não vale para a próxima', () => {
    expect(dmOpenedFor(dmFailed('ana', 'sem rede'), 'bia')).toEqual({
      conversationId: null,
      error: null
    })
  })

  it('o erro vale para a própria pessoa e some quando a nova tentativa abre', () => {
    expect(dmOpenedFor(dmFailed('ana', 'sem rede'), 'ana')).toEqual({
      conversationId: null,
      error: 'sem rede'
    })
    expect(dmOpenedFor(dmOpened('ana', 'c-ana'), 'ana').error).toBeNull()
  })

  it('sem nada guardado ou sem pessoa na rota, está abrindo', () => {
    const abrindo = { conversationId: null, error: null }
    expect(dmOpenedFor(null, 'ana')).toEqual(abrindo)
    expect(dmOpenedFor(dmOpened('ana', 'c-ana'), undefined)).toEqual(abrindo)
  })
})
