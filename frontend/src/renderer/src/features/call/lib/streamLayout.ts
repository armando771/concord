/**
 * Layout do mosaico de transmissões (multistream): uma árvore de divisões,
 * como nos gerenciadores de janela em mosaico. Cada folha é uma transmissão;
 * cada divisão reparte o espaço entre os filhos em linha ou em coluna, com
 * tamanhos em frações (somam 1). Como tudo é fração do espaço disponível, o
 * mosaico acompanha o redimensionamento da janela e nada sai das bordas.
 */

export type Direction = 'row' | 'column'

export type LayoutNode =
  | { type: 'leaf'; id: string }
  | { type: 'split'; direction: Direction; children: LayoutNode[]; sizes: number[] }

export type LayoutPreset = 'grid' | 'row' | 'column' | 'focus'

/** Onde a transmissão arrastada foi solta em cima de outra. */
export type DropSide = 'center' | 'left' | 'right' | 'top' | 'bottom'

/** Menor tamanho de um bloco, em px (abaixo disso o vídeo fica inútil). */
export const MIN_TILE_WIDTH = 200
export const MIN_TILE_HEIGHT = 120

/** Espessura da divisória entre blocos, em px. */
export const GUTTER = 8

/** Fração que a transmissão em destaque ocupa no formato "Destaque". */
export const FOCUS_SHARE = 0.72

const leaf = (id: string): LayoutNode => ({ type: 'leaf', id })

const equal = (n: number): number[] => Array.from({ length: n }, () => 1 / n)

function split(direction: Direction, children: LayoutNode[], sizes?: number[]): LayoutNode {
  if (children.length === 1) return children[0]
  return { type: 'split', direction, children, sizes: sizes ?? equal(children.length) }
}

/** Monta o layout de um formato pronto. */
export function presetLayout(
  preset: LayoutPreset,
  ids: string[],
  focusId?: string | null
): LayoutNode | null {
  if (ids.length === 0) return null
  if (ids.length === 1) return leaf(ids[0])

  switch (preset) {
    case 'row':
      return split('row', ids.map(leaf))
    case 'column':
      return split('column', ids.map(leaf))
    case 'focus': {
      const main = focusId && ids.includes(focusId) ? focusId : ids[0]
      const rest = ids.filter((id) => id !== main)
      return split(
        'row',
        [leaf(main), split('column', rest.map(leaf))],
        [FOCUS_SHARE, 1 - FOCUS_SHARE]
      )
    }
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(ids.length))
      const rows: LayoutNode[] = []
      for (let i = 0; i < ids.length; i += cols) {
        rows.push(split('row', ids.slice(i, i + cols).map(leaf)))
      }
      return split('column', rows)
    }
  }
}

export function leafIds(node: LayoutNode | null): string[] {
  if (!node) return []
  if (node.type === 'leaf') return [node.id]
  return node.children.flatMap(leafIds)
}

/** Reescala para somar 1 (protege contra erros de arredondamento). */
function normalize(sizes: number[]): number[] {
  const total = sizes.reduce((a, b) => a + b, 0)
  return total > 0 ? sizes.map((s) => s / total) : equal(sizes.length)
}

/**
 * Arruma a árvore depois de uma remoção: divisão com um filho vira o filho,
 * e divisão dentro de outra na mesma direção é achatada (os tamanhos são
 * multiplicados), para a árvore não crescer à toa.
 */
function tidy(node: LayoutNode): LayoutNode {
  if (node.type === 'leaf') return node
  const children: LayoutNode[] = []
  const sizes: number[] = []
  node.children.forEach((raw, i) => {
    const child = tidy(raw)
    if (child.type === 'split' && child.direction === node.direction) {
      child.children.forEach((grand, j) => {
        children.push(grand)
        sizes.push(node.sizes[i] * child.sizes[j])
      })
    } else {
      children.push(child)
      sizes.push(node.sizes[i])
    }
  })
  if (children.length === 1) return children[0]
  return { type: 'split', direction: node.direction, children, sizes: normalize(sizes) }
}

export function removeLeaf(node: LayoutNode | null, id: string): LayoutNode | null {
  if (!node) return null
  if (node.type === 'leaf') return node.id === id ? null : node
  const children: LayoutNode[] = []
  const sizes: number[] = []
  node.children.forEach((child, i) => {
    const next = removeLeaf(child, id)
    if (next) {
      children.push(next)
      sizes.push(node.sizes[i])
    }
  })
  if (children.length === 0) return null
  return tidy({ type: 'split', direction: node.direction, children, sizes: normalize(sizes) })
}

/** Põe uma transmissão nova no fim do mosaico, sem desfazer o que já foi ajustado. */
function appendLeaf(node: LayoutNode | null, id: string): LayoutNode {
  if (!node) return leaf(id)
  if (node.type === 'leaf') return split('row', [node, leaf(id)])
  const n = node.children.length
  return {
    ...node,
    children: [...node.children, leaf(id)],
    sizes: [...node.sizes.map((s) => (s * n) / (n + 1)), 1 / (n + 1)]
  }
}

/**
 * Acompanha quem está transmitindo: tira quem parou e acrescenta quem
 * começou, preservando o arranjo atual. Sem layout ainda, usa o formato.
 */
export function syncLayout(
  node: LayoutNode | null,
  ids: string[],
  preset: LayoutPreset
): LayoutNode | null {
  if (!node) return presetLayout(preset, ids)
  let next: LayoutNode | null = node
  const wanted = new Set(ids)
  for (const id of leafIds(node)) {
    if (!wanted.has(id)) next = removeLeaf(next, id)
  }
  const present = new Set(leafIds(next))
  for (const id of ids) {
    if (!present.has(id)) next = appendLeaf(next, id)
  }
  return next
}

function swapLeaves(node: LayoutNode, a: string, b: string): LayoutNode {
  if (node.type === 'leaf') {
    if (node.id === a) return leaf(b)
    if (node.id === b) return leaf(a)
    return node
  }
  return { ...node, children: node.children.map((c) => swapLeaves(c, a, b)) }
}

const sideAxis = (side: DropSide): Direction =>
  side === 'left' || side === 'right' ? 'row' : 'column'

const sideBefore = (side: DropSide): boolean => side === 'left' || side === 'top'

function insertBeside(node: LayoutNode, targetId: string, id: string, side: DropSide): LayoutNode {
  const axis = sideAxis(side)
  const pair = (target: LayoutNode): LayoutNode =>
    split(axis, sideBefore(side) ? [leaf(id), target] : [target, leaf(id)], [0.5, 0.5])

  if (node.type === 'leaf') return node.id === targetId ? pair(node) : node

  const index = node.children.findIndex((c) => c.type === 'leaf' && c.id === targetId)
  if (index !== -1 && node.direction === axis) {
    // Mesma direção: entra ao lado do alvo dividindo o espaço dele ao meio.
    const half = node.sizes[index] / 2
    const at = sideBefore(side) ? index : index + 1
    const children = [...node.children]
    const sizes = [...node.sizes]
    sizes[index] = half
    children.splice(at, 0, leaf(id))
    sizes.splice(at, 0, half)
    return { ...node, children, sizes }
  }
  return { ...node, children: node.children.map((c) => insertBeside(c, targetId, id, side)) }
}

/**
 * Arrastar e soltar: no centro troca as duas de lugar; numa borda tira a
 * transmissão de onde estava e a põe daquele lado do alvo.
 */
export function moveLeaf(
  node: LayoutNode | null,
  draggedId: string,
  targetId: string,
  side: DropSide
): LayoutNode | null {
  if (!node || draggedId === targetId) return node
  const ids = leafIds(node)
  if (!ids.includes(draggedId) || !ids.includes(targetId)) return node
  if (side === 'center') return swapLeaves(node, draggedId, targetId)
  const without = removeLeaf(node, draggedId)
  if (!without) return node
  return tidy(insertBeside(without, targetId, draggedId, side))
}

/** Quantos blocos mínimos o nó precisa lado a lado na direção `axis`. */
export function minUnits(node: LayoutNode, axis: Direction): number {
  if (node.type === 'leaf') return 1
  const units = node.children.map((c) => minUnits(c, axis))
  return node.direction === axis ? units.reduce((a, b) => a + b, 0) : Math.max(...units)
}

/** Espaço mínimo (px) que o nó precisa na direção `axis`, contando divisórias. */
export function minExtent(node: LayoutNode, axis: Direction): number {
  const tile = axis === 'row' ? MIN_TILE_WIDTH : MIN_TILE_HEIGHT
  if (node.type === 'leaf') return tile
  const extents = node.children.map((c) => minExtent(c, axis))
  if (node.direction !== axis) return Math.max(...extents)
  return extents.reduce((a, b) => a + b, 0) + GUTTER * (node.children.length - 1)
}

/**
 * Arrasta a divisória `divider` (entre os filhos divider e divider+1) em
 * `delta` (fração do espaço da divisão). Os dois vizinhos nunca ficam abaixo
 * do mínimo deles (`mins`, em fração); os outros filhos não mudam.
 */
export function resizeSizes(
  sizes: number[],
  divider: number,
  delta: number,
  mins: number[]
): number[] {
  const a = sizes[divider]
  const b = sizes[divider + 1]
  if (a === undefined || b === undefined) return sizes
  const lo = (mins[divider] ?? 0) - a
  const hi = b - (mins[divider + 1] ?? 0)
  if (lo > hi) return sizes // não cabe: deixa como está
  const d = Math.min(hi, Math.max(lo, delta))
  const next = [...sizes]
  next[divider] = a + d
  next[divider + 1] = b - d
  return next
}

/** Aplica `fn` na divisão no caminho `path` (índices dos filhos a partir da raiz). */
export function updateSplitAt(
  node: LayoutNode,
  path: number[],
  fn: (split: Extract<LayoutNode, { type: 'split' }>) => LayoutNode
): LayoutNode {
  if (node.type === 'leaf') return node
  if (path.length === 0) return fn(node)
  const [head, ...rest] = path
  return {
    ...node,
    children: node.children.map((c, i) => (i === head ? updateSplitAt(c, rest, fn) : c))
  }
}

/**
 * Responsividade: se uma divisão em linha não cabe na largura disponível
 * (cada bloco precisa de MIN_TILE_WIDTH), ela é mostrada em coluna — e
 * vice-versa na altura. Só muda a exibição; o arranjo salvo continua igual.
 */
export function adaptToSize(node: LayoutNode, width: number, height: number): LayoutNode {
  if (node.type === 'leaf') return node

  let direction = node.direction
  const fits = (dir: Direction): boolean =>
    dir === 'row'
      ? minExtent({ ...node, direction: 'row' }, 'row') <= width
      : minExtent({ ...node, direction: 'column' }, 'column') <= height
  if (!fits(direction)) {
    const other: Direction = direction === 'row' ? 'column' : 'row'
    if (fits(other)) direction = other
  }

  const gutters = GUTTER * (node.children.length - 1)
  const children = node.children.map((child, i) => {
    const share = node.sizes[i]
    return direction === 'row'
      ? adaptToSize(child, (width - gutters) * share, height)
      : adaptToSize(child, width, (height - gutters) * share)
  })
  return { ...node, direction, children }
}

/**
 * Quem está no bloco grande do formato "Destaque" (o primeiro filho da raiz,
 * se for uma transmissão), ou null.
 */
export function featuredLeaf(node: LayoutNode | null): string | null {
  if (!node || node.type === 'leaf') return node?.id ?? null
  const first = node.children[0]
  return first?.type === 'leaf' ? first.id : null
}
