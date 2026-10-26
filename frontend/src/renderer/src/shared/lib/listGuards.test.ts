import { describe, expect, it, vi } from 'vitest'
import { keepWithId } from './listGuards'

describe('keepWithId', () => {
  it('não lista vira []', () => {
    expect(keepWithId(undefined, 'id', 't')).toEqual([])
    expect(keepWithId({ id: 'a' }, 'id', 't')).toEqual([])
  })

  it('tira null, arrays e itens sem a chave', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      keepWithId([{ id: 'a' }, null, [], { id: '' }, { id: 1 }, { user_id: 'b' }], 'id', 't')
    ).toEqual([{ id: 'a' }])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('usa a chave pedida', () => {
    expect(keepWithId([{ user_id: 'b' }, { id: 'a' }], 'user_id', 't')).toEqual([{ user_id: 'b' }])
  })
})
