import type { CSSProperties } from 'react'

// Larguras dos skeletons de carregamento. Pseudo-aleatórias mas determinísticas:
// o mesmo seed dá sempre as mesmas barras, então o skeleton não "dança" a cada
// render nem difere entre o teste e a tela.

/** mulberry32: gerador de 0 a 1 a partir de um seed inteiro. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `count` larguras em %, entre `min` e `max`. */
export function skeletonWidths(
  count: number,
  { min = 30, max = 90, seed = 1 }: { min?: number; max?: number; seed?: number } = {}
): number[] {
  const rand = seeded(seed)
  return Array.from({ length: Math.max(0, count) }, () => Math.round(min + rand() * (max - min)))
}

export interface MessageSkeletonRow {
  /** Largura do nome do autor, em px. */
  namePx: number
  /** Largura de cada barra de texto, em % (de 1 a 3 barras). */
  lines: number[]
}

/** Linhas do skeleton do chat: nome mais 1 a 3 barras de texto, de tamanhos variados. */
export function messageSkeletonRows(count: number, seed = 7): MessageSkeletonRow[] {
  const rand = seeded(seed)
  return Array.from({ length: Math.max(0, count) }, () => {
    const roll = rand()
    const lineCount = roll < 0.4 ? 1 : roll < 0.8 ? 2 : 3
    const lines: number[] = []
    for (let i = 0; i < lineCount; i++) {
      const last = i === lineCount - 1
      // Só a última barra é mais curta (o fim do parágrafo); as outras vão longe.
      const width = last && lineCount > 1 ? 20 + rand() * 20 : 45 + rand() * 45
      lines.push(Math.round(width))
    }
    return { namePx: Math.round(64 + rand() * 86), lines }
  })
}

/** Estilo com a largura em % de uma barra. */
export const pct = (width: number): CSSProperties => ({ width: `${width}%` })
