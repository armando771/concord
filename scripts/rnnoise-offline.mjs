// Roda o RNNoise de verdade (o mesmo worklet + WASM que o app usa) sobre um
// WAV, fora do navegador, e grava o resultado para ouvir antes/depois.
//   node scripts/rnnoise-offline.mjs entrada.wav saida.wav
// Entrada: WAV PCM 16 bits, 48 kHz (mono ou estéreo — usa o canal esquerdo).
// Imprime o nível (dBFS) de entrada e saída a cada meio segundo.
import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const pkgDir = require.resolve('@sapphi-red/web-noise-suppressor').replace(/[\\/]dist[\\/]index\.c?js$/, '')
const BLOCK = 128

/** Instancia o AudioWorkletProcessor do RNNoise no Node (globais simulados). */
export async function createRnnoise() {
  let Processor
  globalThis.AudioWorkletProcessor ??= class {
    constructor() {
      this.port = { addEventListener() {}, start() {}, postMessage() {} }
    }
  }
  globalThis.registerProcessor = (_name, cls) => { Processor = cls }
  await import(pathToFileURL(`${pkgDir}/dist/rnnoise/workletProcessor.js`).href + `?t=${Date.now()}`)
  const wasmBinary = readFileSync(`${pkgDir}/dist/rnnoise_simd.wasm`).buffer
  // O glue do Emscripten vê `process` e tenta o caminho do Node (fs, __dirname);
  // no AudioWorklet ele não existe. A detecção roda dentro do construtor
  // (síncrona), então basta esconder durante ele.
  const realProcess = globalThis.process
  Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true, writable: true })
  let proc
  try {
    proc = new Processor({ processorOptions: { wasmBinary, maxChannels: 1 } })
  } finally {
    Object.defineProperty(globalThis, 'process', { value: realProcess, configurable: true, writable: true })
  }
  for (let i = 0; i < 200 && !proc.processor; i++) await new Promise((r) => setTimeout(r, 10))
  if (!proc.processor) throw new Error('RNNoise não carregou')
  return {
    /** Processa um sinal mono inteiro em blocos de 128 (como o Web Audio). */
    run(input) {
      const out = new Float32Array(input.length)
      for (let i = 0; i + BLOCK <= input.length; i += BLOCK) {
        const o = new Float32Array(BLOCK)
        proc.process([[input.subarray(i, i + BLOCK)]], [[o]])
        out.set(o, i)
      }
      return out
    },
    destroy: () => proc.destroy()
  }
}

export function readWav(path) {
  const buf = readFileSync(path)
  let off = 12
  let fmt
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) }
    if (id === 'data') {
      if (!fmt || fmt.bits !== 16) throw new Error('precisa de WAV PCM 16 bits')
      const frames = Math.floor(size / (2 * fmt.channels))
      const samples = new Float32Array(frames)
      for (let i = 0; i < frames; i++) samples[i] = buf.readInt16LE(off + 8 + i * 2 * fmt.channels) / 32768
      return { rate: fmt.rate, samples }
    }
    off += 8 + size + (size % 2)
  }
  throw new Error('WAV sem bloco data')
}

export function writeWav(path, samples, rate = 48000) {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2))
  writeFileSync(path, buf)
}

export const dbfs = (s) => {
  let sum = 0
  for (const v of s) sum += v * v
  return 10 * Math.log10(sum / Math.max(1, s.length) + 1e-12)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [inPath, outPath] = process.argv.slice(2)
  if (!inPath || !outPath) {
    console.error('uso: node scripts/rnnoise-offline.mjs entrada.wav saida.wav')
    process.exit(1)
  }
  const { rate, samples } = readWav(inPath)
  if (rate !== 48000) throw new Error(`o RNNoise trabalha a 48 kHz (o arquivo é ${rate} Hz)`)
  const rnnoise = await createRnnoise()
  const out = rnnoise.run(samples)
  rnnoise.destroy()
  writeWav(outPath, out, rate)
  const step = rate / 2
  console.log('tempo   entrada   saída   (dBFS)')
  for (let i = 0; i + step <= samples.length; i += step) {
    const a = dbfs(samples.subarray(i, i + step)).toFixed(1).padStart(7)
    const b = dbfs(out.subarray(i, i + step)).toFixed(1).padStart(7)
    console.log(`${(i / rate).toFixed(1).padStart(4)}s ${a}  ${b}`)
  }
  console.log(`total: ${dbfs(samples).toFixed(1)} → ${dbfs(out).toFixed(1)} dBFS — gravado em ${outPath}`)
}
