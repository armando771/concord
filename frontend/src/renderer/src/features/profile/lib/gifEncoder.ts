// Codificador de GIF animado (sem dependência). O recorte do avatar/banner/ícone
// precisa manter a animação, e o canvas só devolve imagem parada; então os
// quadros recortados são escritos aqui. Índice 0 da paleta é a transparência.
import { framePatches, type GifPatch } from './gifDelta'

export interface GifFrame {
  /** Índice na paleta de cada pixel (0 = transparente), linha a linha. */
  indices: Uint8Array
  delayMs: number
}

export interface GifInput {
  width: number
  height: number
  /** Cores a partir do índice 1 (até 255). */
  palette: [number, number, number][]
  frames: GifFrame[]
}

/** Navegadores tratam atraso abaixo de 20 ms como 100 ms; fixa o piso. */
const MIN_DELAY_MS = 20
const MIN_CODE_SIZE = 8
const CLEAR = 1 << MIN_CODE_SIZE
const END = CLEAR + 1
const MAX_CODES = 4096

const word = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff]
const ascii = (text: string): number[] => Array.from(text, (c) => c.charCodeAt(0))

/** Escreve códigos de largura variável, do bit menos significativo. */
class BitWriter {
  readonly bytes: number[] = []
  private acc = 0
  private bits = 0

  write(code: number, size: number): void {
    this.acc |= code << this.bits
    this.bits += size
    while (this.bits >= 8) {
      this.bytes.push(this.acc & 0xff)
      this.acc >>>= 8
      this.bits -= 8
    }
  }

  finish(): number[] {
    if (this.bits > 0) this.bytes.push(this.acc & 0xff)
    return this.bytes
  }
}

function lzwCompress(indices: Uint8Array): number[] {
  const out = new BitWriter()
  let dict = new Map<number, number>()
  let next = END + 1
  let size = MIN_CODE_SIZE + 1
  out.write(CLEAR, size)
  let prefix = indices[0]
  for (let i = 1; i < indices.length; i++) {
    const key = (prefix << 8) | indices[i]
    const found = dict.get(key)
    if (found !== undefined) {
      prefix = found
      continue
    }
    out.write(prefix, size)
    if (next < MAX_CODES) {
      dict.set(key, next++)
      if (next > 1 << size && size < 12) size++
    } else {
      out.write(CLEAR, size)
      dict = new Map()
      next = END + 1
      size = MIN_CODE_SIZE + 1
    }
    prefix = indices[i]
  }
  out.write(prefix, size)
  out.write(END, size)
  return out.finish()
}

/** Dados do LZW em sub-blocos de até 255 bytes, terminados em 0. */
function subBlocks(data: number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.slice(i, i + 255)
    out.push(chunk.length, ...chunk)
  }
  out.push(0)
  return out
}

function header(width: number, height: number, palette: GifInput['palette']): number[] {
  const table: number[] = [0, 0, 0]
  for (let i = 0; i < 255; i++) table.push(...(palette[i] ?? [0, 0, 0]))
  const loop = [0x21, 0xff, 0x0b, ...ascii('NETSCAPE2.0'), 3, 1, 0, 0, 0]
  const sizes = [...word(width), ...word(height), 0xf7, 0, 0]
  return [...ascii('GIF89a'), ...sizes, ...table, ...loop]
}

/** Disposal 1 (fica na tela) ou 2 (limpa), sempre com transparência no índice 0. */
const KEEP = 0x05
const CLEAR_AFTER = 0x09

function frameBytes(patch: GifPatch): number[] {
  const delay = Math.round(Math.max(MIN_DELAY_MS, patch.delayMs) / 10)
  const control = [0x21, 0xf9, 4, patch.keep ? KEEP : CLEAR_AFTER, ...word(delay), 0, 0]
  const place = [...word(patch.left), ...word(patch.top), ...word(patch.width), ...word(patch.height)]
  const descriptor = [0x2c, ...place, 0]
  return [...control, ...descriptor, MIN_CODE_SIZE, ...subBlocks(lzwCompress(patch.indices))]
}

export function encodeGif({ width, height, palette, frames }: GifInput): Uint8Array {
  const parts = [header(width, height, palette)]
  for (const patch of framePatches(frames, width, height)) parts.push(frameBytes(patch))
  parts.push([0x3b])
  return Uint8Array.from(parts.flat())
}
