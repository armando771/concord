// Leitor de GIF só para os testes: confere o que o encoder escreveu.

/** Decodificador LZW mínimo, só para conferir o que o encoder escreveu. */
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
    if (prev) table.push([...prev, entry[0]])
    if (table.length === 1 << size && size < 12) size++
    prev = entry
  }
  return out
}

/** Lê os quadros do GIF: atraso e índices decodificados. */
export function readFrames(bytes: Uint8Array): { delay: number; indices: number[] }[] {
  let pos = 13 + 3 * 256
  const frames: { delay: number; indices: number[] }[] = []
  let delay = 0
  let width = bytes[6] | (bytes[7] << 8)
  let height = bytes[8] | (bytes[9] << 8)
  while (bytes[pos] !== 0x3b) {
    if (bytes[pos] === 0x21) {
      if (bytes[pos + 1] === 0xf9) delay = (bytes[pos + 4] | (bytes[pos + 5] << 8)) * 10
      pos += 2
      while (bytes[pos] !== 0) pos += bytes[pos] + 1
      pos++
    } else {
      pos += 10
      const minCode = bytes[pos++]
      const data: number[] = []
      while (bytes[pos] !== 0) {
        data.push(...bytes.slice(pos + 1, pos + 1 + bytes[pos]))
        pos += bytes[pos] + 1
      }
      pos++
      frames.push({ delay, indices: lzwDecode(minCode, data, width * height) })
    }
  }
  return frames
}
