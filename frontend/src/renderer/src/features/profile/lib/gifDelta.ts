// Quadros do GIF como retângulos alterados. Gravar cada quadro inteiro faz um
// GIF que só mexe num canto inflar várias vezes ao ser reescrito; então, numa
// animação sem transparência, cada quadro grava só o retângulo que mudou, com
// os pixels iguais ao anterior como transparentes (o anterior continua na tela).

export interface GifPatch {
  left: number
  top: number
  width: number
  height: number
  /** Índices do retângulo, linha a linha (0 = transparente). */
  indices: Uint8Array
  delayMs: number
  /** Disposal 1 (o quadro fica na tela); senão 2 (limpa antes do próximo). */
  keep: boolean
}

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** Menor retângulo com os pixels que mudaram; null quando nada mudou. */
function changedBox(prev: Uint8Array, cur: Uint8Array, width: number): Box | null {
  let box: Box | null = null
  for (let i = 0; i < cur.length; i++) {
    if (cur[i] === prev[i]) continue
    const x = i % width
    const y = Math.floor(i / width)
    box ??= { left: x, top: y, right: x, bottom: y }
    box.left = Math.min(box.left, x)
    box.right = Math.max(box.right, x)
    box.bottom = y
  }
  return box
}

function deltaPatch(prev: Uint8Array, cur: Uint8Array, width: number, delayMs: number): GifPatch {
  const box = changedBox(prev, cur, width)
  // nada mudou: um pixel transparente segura o quadro anterior pelo atraso
  if (!box)
    return { left: 0, top: 0, width: 1, height: 1, indices: new Uint8Array(1), delayMs, keep: true }
  const w = box.right - box.left + 1
  const h = box.bottom - box.top + 1
  const indices = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const at = (box.top + y) * width + box.left + x
      if (cur[at] !== prev[at]) indices[y * w + x] = cur[at]
    }
  }
  return { left: box.left, top: box.top, width: w, height: h, indices, delayMs, keep: true }
}

export interface FullFrame {
  indices: Uint8Array
  delayMs: number
}

/**
 * Retângulos a gravar. Com transparência, um pixel que some não tem como ser
 * apagado por cima do anterior: aí cada quadro vai inteiro e limpa a tela.
 */
export function framePatches(frames: FullFrame[], width: number, height: number): GifPatch[] {
  const full = (f: FullFrame, keep: boolean): GifPatch => ({
    left: 0,
    top: 0,
    width,
    height,
    ...f,
    keep
  })
  if (frames.some((f) => f.indices.includes(0))) return frames.map((f) => full(f, false))
  return frames.map((f, i) =>
    i === 0 ? full(f, true) : deltaPatch(frames[i - 1].indices, f.indices, width, f.delayMs)
  )
}
