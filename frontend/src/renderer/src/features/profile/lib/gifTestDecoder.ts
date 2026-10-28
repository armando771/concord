// Leitor de GIF só para os testes: confere o que o encoder escreveu e lê as
// fixtures. Compõe os quadros como o navegador (retângulo, transparência e
// disposal 0/1/2), para comparar o que aparece na tela.

/** Decodificador LZW mínimo. */
export function lzwDecode(minCode: number, data: number[], total: number): number[] {
  const clear = 1 << minCode
  const end = clear + 1
  let table: number[][] = []
  const reset = (): void => {
    table = []
    for (let i = 0; i < clear; i++) table.push([i])
    table.push([], [])
  }
  reset()
  let size = minCode + 1
  let bits = 0
  let acc = 0
  let pos = 0
  let prev: number[] | null = null
  const out: number[] = []
  while (out.length < total) {
    while (bits < size) {
      acc |= data[pos++] << bits
      bits += 8
    }
    const code = acc & ((1 << size) - 1)
    acc >>= size
    bits -= size
    if (code === clear) {
      reset()
      size = minCode + 1
      prev = null
      continue
    }
    if (code === end) break
    const entry: number[] = code < table.length ? table[code] : [...prev!, prev![0]]
    out.push(...entry)
    if (prev && table.length < 4096) table.push([...prev, entry[0]])
    if (table.length === 1 << size && size < 12) size++
    prev = entry
  }
  return out
}

export interface DecodedFrame {
  delay: number
  /** Como o quadro aparece na tela, RGBA da imagem inteira. */
  rgba: Uint8ClampedArray
}

export interface DecodedGif {
  width: number
  height: number
  frames: DecodedFrame[]
}

class Reader {
  pos = 0
  constructor(private readonly bytes: Uint8Array) {}

  byte(): number {
    return this.bytes[this.pos++]
  }

  word(): number {
    return this.byte() | (this.byte() << 8)
  }

  /** Sub-blocos até o terminador 0, emendados. */
  blocks(): number[] {
    const data: number[] = []
    for (let n = this.byte(); n !== 0; n = this.byte()) {
      data.push(...this.bytes.slice(this.pos, this.pos + n))
      this.pos += n
    }
    return data
  }

  colors(flags: number): number[][] | null {
    if (!(flags & 0x80)) return null
    const table: number[][] = []
    for (let i = 0; i < 2 << (flags & 7); i++) table.push([this.byte(), this.byte(), this.byte()])
    return table
  }
}

interface Control {
  delay: number
  disposal: number
  transparent: number
}

interface Patch {
  left: number
  top: number
  width: number
  height: number
  indices: number[]
  colors: number[][]
}

function paint(canvas: Uint8ClampedArray, width: number, patch: Patch, transparent: number): void {
  patch.indices.forEach((index, i) => {
    if (index === transparent) return
    const at =
      ((patch.top + Math.floor(i / patch.width)) * width + patch.left + (i % patch.width)) * 4
    canvas.set([...patch.colors[index], 255], at)
  })
}

function clearRect(canvas: Uint8ClampedArray, width: number, patch: Patch): void {
  for (let y = patch.top; y < patch.top + patch.height; y++) {
    canvas.fill(0, (y * width + patch.left) * 4, (y * width + patch.left + patch.width) * 4)
  }
}

function readPatch(r: Reader, global: number[][] | null): Patch {
  const [left, top, width, height] = [r.word(), r.word(), r.word(), r.word()]
  const flags = r.byte()
  if (flags & 0x40) throw new Error('GIF entrelaçado não é suportado no leitor de teste')
  const colors = r.colors(flags) ?? global ?? []
  const minCode = r.byte()
  return {
    left,
    top,
    width,
    height,
    colors,
    indices: lzwDecode(minCode, r.blocks(), width * height)
  }
}

function readControl(r: Reader): Control {
  const [packed, lo, hi, index] = r.blocks()
  return {
    delay: (lo | (hi << 8)) * 10,
    disposal: (packed >> 2) & 7,
    transparent: packed & 1 ? index : -1
  }
}

/** Lê o GIF e devolve cada quadro já composto. */
export function decodeGif(bytes: Uint8Array): DecodedGif {
  const r = new Reader(bytes)
  r.pos = 6
  const width = r.word()
  const height = r.word()
  const flags = r.byte()
  r.pos += 2
  const global = r.colors(flags)
  const canvas = new Uint8ClampedArray(width * height * 4)
  const frames: DecodedFrame[] = []
  let control: Control = { delay: 0, disposal: 0, transparent: -1 }
  for (let tag = r.byte(); tag !== 0x3b; tag = r.byte()) {
    if (tag === 0x21) {
      const label = r.byte()
      if (label === 0xf9) control = readControl(r)
      else r.blocks()
      continue
    }
    const patch = readPatch(r, global)
    paint(canvas, width, patch, control.transparent)
    frames.push({ delay: control.delay, rgba: canvas.slice() })
    if (control.disposal === 2) clearRect(canvas, width, patch)
  }
  return { width, height, frames }
}
