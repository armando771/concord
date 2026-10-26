import { describe, expect, it, vi } from 'vitest'
import {
  channelDropHandlers,
  dropLineSide,
  dropMove,
  nextDropAt,
  sameDropAt,
  type ChannelDropContext,
  type DropAt
} from './channelDrop'
import { channelDragType } from './channelOrder'

describe('dropLineSide', () => {
  it('linha antes do bloco, ou depois só no último', () => {
    expect(dropLineSide({ type: 'text', index: 1 }, 'text', 1, false)).toBe('before')
    expect(dropLineSide({ type: 'text', index: 2 }, 'text', 1, true)).toBe('after')
    expect(dropLineSide({ type: 'text', index: 2 }, 'text', 1, false)).toBeNull()
    expect(dropLineSide({ type: 'voice', index: 1 }, 'text', 1, false)).toBeNull()
    expect(dropLineSide(null, 'text', 1, false)).toBeNull()
  })
})

describe('regras do soltar', () => {
  it('mesma posição', () => {
    expect(sameDropAt({ type: 'text', index: 1 }, { type: 'text', index: 1 })).toBe(true)
    expect(sameDropAt({ type: 'text', index: 1 }, null)).toBe(false)
    expect(sameDropAt(null, null)).toBe(true)
  })

  it('logo acima/abaixo do próprio canal não mostra linha', () => {
    expect(nextDropAt('text', 1, 1)).toBeNull()
    expect(nextDropAt('text', 2, 1)).toBeNull()
    expect(nextDropAt('text', 3, 1)).toEqual({ type: 'text', index: 3 })
    expect(nextDropAt('voice', 0, -1)).toEqual({ type: 'voice', index: 0 })
  })

  it('de onde para onde o canal vai', () => {
    expect(dropMove(['a', 'b', 'c'], 'a', 3)).toEqual({ from: 0, to: 2 })
    expect(dropMove(['a', 'b', 'c'], 'c', 0)).toEqual({ from: 2, to: 0 })
    expect(dropMove(['a', 'b', 'c'], 'b', 2)).toBeNull()
    expect(dropMove(['a', 'b', 'c'], 'x', 0)).toBeNull()
  })
})

function dragEvent(types: string[], data = ''): React.DragEvent<HTMLElement> {
  return {
    preventDefault: vi.fn(),
    clientY: 30,
    currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 40 }) },
    dataTransfer: { types, getData: () => data, dropEffect: 'none' }
  } as unknown as React.DragEvent<HTMLElement>
}

function context(over: Partial<ChannelDropContext> = {}): ChannelDropContext {
  return {
    type: 'text',
    index: 0,
    canManage: true,
    sectionIds: ['a', 'b', 'c'],
    drag: { id: 'c', type: 'text' },
    setDrag: vi.fn(),
    setDropAt: vi.fn(),
    reorder: vi.fn(),
    ...over
  }
}

describe('channelDropHandlers', () => {
  const textType = channelDragType('text')

  it('passando por cima: mostra a linha (metade de baixo = depois)', () => {
    const ctx = context()
    const e = dragEvent([textType])
    channelDropHandlers(ctx).onDragOver(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.dataTransfer.dropEffect).toBe('move')
    const update = vi.mocked(ctx.setDropAt).mock.calls[0][0]
    const cur: DropAt = { type: 'text', index: 1 }
    expect(update(cur)).toBe(cur)
    expect(update(null)).toEqual({ type: 'text', index: 1 })
  })

  it('quem não gerencia canais, ou arrasto de outra seção, é ignorado', () => {
    const ctx = context({ canManage: false })
    channelDropHandlers(ctx).onDragOver(dragEvent([textType]))
    channelDropHandlers(context()).onDragOver(dragEvent([channelDragType('voice')]))
    expect(ctx.setDropAt).not.toHaveBeenCalled()
  })

  it('soltar reordena e limpa o arrasto', () => {
    const ctx = context()
    const e = dragEvent([textType], 'c')
    channelDropHandlers(ctx).onDrop(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(ctx.setDrag).toHaveBeenCalledWith(null)
    expect(vi.mocked(ctx.setDropAt).mock.calls[0][0](null)).toBeNull()
    // Metade de baixo do primeiro bloco: entra depois dele.
    expect(ctx.reorder).toHaveBeenCalledWith('text', 2, 1)
  })

  it('soltar no mesmo lugar não reordena; sem dado ou sem permissão, nada', () => {
    const same = context({ index: 2 })
    channelDropHandlers(same).onDrop(dragEvent([textType], 'c'))
    expect(same.setDrag).toHaveBeenCalledWith(null)
    expect(same.reorder).not.toHaveBeenCalled()

    const empty = context()
    channelDropHandlers(empty).onDrop(dragEvent([textType], ''))
    channelDropHandlers(context({ canManage: false })).onDrop(dragEvent([textType], 'c'))
    expect(empty.setDrag).not.toHaveBeenCalled()
  })
})
