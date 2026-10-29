import { describe, expect, it } from 'vitest'
import { pendingCopy } from './pendingCopy'

describe('pendingCopy', () => {
  it('pedido recebido pode ser recusado', () => {
    expect(pendingCopy(true)).toEqual({
      subtitle: 'Pedido de amizade recebido',
      denyLabel: 'Recusar'
    })
  })
  it('pedido enviado pode ser cancelado', () => {
    expect(pendingCopy(false)).toEqual({
      subtitle: 'Pedido de amizade enviado',
      denyLabel: 'Cancelar'
    })
  })
})
