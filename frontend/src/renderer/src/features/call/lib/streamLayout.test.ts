import { describe, expect, it } from 'vitest'
import {
  adaptToSize,
  featuredLeaf,
  FOCUS_SHARE,
  GUTTER,
  leafIds,
  minExtent,
  MIN_TILE_WIDTH,
  moveLeaf,
  presetLayout,
  removeLeaf,
  resizeSizes,
  syncLayout,
  updateSplitAt,
  type LayoutNode
} from './streamLayout'

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

/** Desenho compacto da árvore para comparar: row(a,col(b,c)). */
function shape(node: LayoutNode | null): string {
  if (!node) return '∅'
  if (node.type === 'leaf') return node.id
  const name = node.direction === 'row' ? 'row' : 'col'
  return `${name}(${node.children.map(shape).join(',')})`
}

describe('presetLayout', () => {
  it('lado a lado, empilhado e uma só', () => {
    expect(shape(presetLayout('row', ['a', 'b', 'c', 'd']))).toBe('row(a,b,c,d)')
    expect(shape(presetLayout('column', ['a', 'b']))).toBe('col(a,b)')
    expect(shape(presetLayout('grid', ['a']))).toBe('a')
    expect(presetLayout('grid', [])).toBeNull()
  })

  it('grade quase quadrada', () => {
    expect(shape(presetLayout('grid', ['a', 'b', 'c', 'd']))).toBe('col(row(a,b),row(c,d))')
    expect(shape(presetLayout('grid', ['a', 'b', 'c']))).toBe('col(row(a,b),c)')
  })

  it('destaque: uma grande e o resto em coluna ao lado', () => {
    const node = presetLayout('focus', ['a', 'b', 'c'], 'b')
    expect(shape(node)).toBe('row(b,col(a,c))')
    expect(node?.type === 'split' && node.sizes[0]).toBe(FOCUS_SHARE)
  })
})

describe('syncLayout', () => {
  it('tira quem parou de transmitir e arruma a árvore', () => {
    const grid = presetLayout('grid', ['a', 'b', 'c', 'd'])
    const next = syncLayout(grid, ['a', 'b', 'c'], 'grid')
    expect(shape(next)).toBe('col(row(a,b),c)')
  })

  it('acrescenta quem começou sem desfazer os tamanhos ajustados', () => {
    const custom: LayoutNode = {
      type: 'split',
      direction: 'row',
      children: [
        { type: 'leaf', id: 'a' },
        { type: 'leaf', id: 'b' }
      ],
      sizes: [0.8, 0.2]
    }
    const next = syncLayout(custom, ['a', 'b', 'c'], 'grid')
    expect(shape(next)).toBe('row(a,b,c)')
    if (next?.type !== 'split') throw new Error('esperava divisão')
    expect(next.sizes[0]).toBeGreaterThan(next.sizes[1] * 3)
    expect(sum(next.sizes)).toBeCloseTo(1)
  })

  it('sem layout usa o formato escolhido', () => {
    expect(shape(syncLayout(null, ['a', 'b'], 'column'))).toBe('col(a,b)')
  })
})

describe('removeLeaf', () => {
  it('achata divisões na mesma direção', () => {
    const node: LayoutNode = {
      type: 'split',
      direction: 'row',
      children: [
        { type: 'leaf', id: 'a' },
        {
          type: 'split',
          direction: 'column',
          children: [
            { type: 'leaf', id: 'b' },
            {
              type: 'split',
              direction: 'row',
              children: [
                { type: 'leaf', id: 'c' },
                { type: 'leaf', id: 'd' }
              ],
              sizes: [0.5, 0.5]
            }
          ],
          sizes: [0.5, 0.5]
        }
      ],
      sizes: [0.5, 0.5]
    }
    const next = removeLeaf(node, 'b')
    expect(shape(next)).toBe('row(a,c,d)')
    if (next?.type !== 'split') throw new Error('esperava divisão')
    expect(next.sizes).toEqual([0.5, 0.25, 0.25])
  })
})

describe('moveLeaf', () => {
  const four = presetLayout('row', ['a', 'b', 'c', 'd'])

  it('soltar no centro troca as duas de lugar', () => {
    expect(shape(moveLeaf(four, 'a', 'c', 'center'))).toBe('row(c,b,a,d)')
  })

  it('soltar na borda lateral põe ao lado, na mesma linha', () => {
    expect(shape(moveLeaf(four, 'd', 'a', 'left'))).toBe('row(d,a,b,c)')
    expect(shape(moveLeaf(four, 'a', 'c', 'right'))).toBe('row(b,c,a,d)')
  })

  it('soltar em cima/embaixo empilha com o alvo', () => {
    expect(shape(moveLeaf(four, 'd', 'b', 'bottom'))).toBe('row(a,col(b,d),c)')
    expect(shape(moveLeaf(four, 'd', 'b', 'top'))).toBe('row(a,col(d,b),c)')
  })

  it('tamanhos sempre somam 1', () => {
    const check = (node: LayoutNode | null): void => {
      if (!node || node.type === 'leaf') return
      expect(sum(node.sizes)).toBeCloseTo(1)
      node.children.forEach(check)
    }
    let node = four
    node = moveLeaf(node, 'd', 'b', 'bottom')
    node = moveLeaf(node, 'a', 'd', 'right')
    node = moveLeaf(node, 'c', 'a', 'top')
    check(node)
    expect(leafIds(node).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ignora ids desconhecidos e soltar em si mesma', () => {
    expect(moveLeaf(four, 'a', 'a', 'left')).toBe(four)
    expect(moveLeaf(four, 'x', 'a', 'left')).toBe(four)
  })
})

describe('resizeSizes', () => {
  it('move a divisória sem mexer nos outros', () => {
    expect(resizeSizes([0.25, 0.25, 0.5], 0, 0.1, [0.1, 0.1, 0.1])).toEqual([0.35, 0.15, 0.5])
  })

  it('respeita o mínimo dos dois lados', () => {
    const [a, b] = resizeSizes([0.5, 0.5], 0, 0.9, [0.2, 0.2])
    expect(a).toBeCloseTo(0.8)
    expect(b).toBeCloseTo(0.2)
    const [c, d] = resizeSizes([0.5, 0.5], 0, -0.9, [0.2, 0.2])
    expect(c).toBeCloseTo(0.2)
    expect(d).toBeCloseTo(0.8)
  })

  it('aplica na divisão certa pelo caminho', () => {
    const grid = presetLayout('grid', ['a', 'b', 'c', 'd']) as LayoutNode
    const next = updateSplitAt(grid, [1], (s) => ({
      ...s,
      sizes: resizeSizes(s.sizes, 0, 0.2, [0, 0])
    }))
    if (next.type !== 'split' || next.children[1].type !== 'split') throw new Error()
    expect(next.children[1].sizes[0]).toBeCloseTo(0.7)
    if (next.children[0].type !== 'split') throw new Error()
    expect(next.children[0].sizes[0]).toBeCloseTo(0.5)
  })
})

describe('adaptToSize', () => {
  const four = presetLayout('row', ['a', 'b', 'c', 'd']) as LayoutNode

  it('quatro lado a lado precisam de largura para os quatro', () => {
    expect(minExtent(four, 'row')).toBe(4 * MIN_TILE_WIDTH + 3 * GUTTER)
  })

  it('em janela estreita vira coluna; em larga continua em linha', () => {
    expect(shape(adaptToSize(four, 1400, 700))).toBe('row(a,b,c,d)')
    expect(shape(adaptToSize(four, 500, 900))).toBe('col(a,b,c,d)')
  })

  it('se nem em coluna cabe, mantém como está', () => {
    expect(shape(adaptToSize(four, 300, 200))).toBe('row(a,b,c,d)')
  })
})

describe('featuredLeaf', () => {
  it('no destaque é quem está no bloco grande; trocar põe outro lá', () => {
    const node = presetLayout('focus', ['a', 'b', 'c'])
    expect(featuredLeaf(node)).toBe('a')
    expect(featuredLeaf(moveLeaf(node, 'c', 'a', 'center'))).toBe('c')
  })

  it('uma transmissão só, ou nenhuma', () => {
    expect(featuredLeaf(presetLayout('focus', ['a']))).toBe('a')
    expect(featuredLeaf(null)).toBeNull()
  })
})
