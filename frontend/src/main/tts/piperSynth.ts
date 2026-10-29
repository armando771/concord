// Síntese da voz do /tts no Linux: o binário do Piper com o modelo pt-BR,
// texto pelo stdin, WAV (22 050 Hz, 16 bits, mono) pelo stdout. Uma síntese
// por vez; processo que trava é morto (docs/adr/0014-voz-piper-no-linux.md).
import type { ChildProcess, SpawnOptions } from 'child_process'
import type { PiperPaths } from './voiceInstaller'

export type SpawnPiper = (command: string, args: string[], options: SpawnOptions) => ChildProcess

export interface PiperSynthDeps {
  spawn: SpawnPiper
  /** Sintetizar 200 caracteres leva ~1,5 s num PC comum. */
  timeoutMs?: number
  /** ~11 s de fala ocupam ~0,5 MB; acima disto algo deu errado. */
  maxBytes?: number
}

export type PiperSynth = (paths: PiperPaths, text: string) => Promise<Buffer>

const TIMEOUT_MS = 15_000
const MAX_BYTES = 10 * 1024 * 1024

function runPiper(deps: PiperSynthDeps, paths: PiperPaths, text: string): Promise<Buffer> {
  const maxBytes = deps.maxBytes ?? MAX_BYTES
  return new Promise((resolve, reject) => {
    const child = deps.spawn(
      paths.binary,
      ['--model', paths.model, '--output_file', '-', '--quiet'],
      {
        stdio: ['pipe', 'pipe', 'ignore']
      }
    )
    const chunks: Buffer[] = []
    let size = 0
    let failure: Error | null = null
    const fail = (error: Error): void => {
      failure ??= error
      child.kill('SIGKILL')
    }
    const timer = setTimeout(
      () => fail(new Error('piper passou do tempo-limite')),
      deps.timeoutMs ?? TIMEOUT_MS
    )
    child.stdout?.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) return fail(new Error('áudio grande demais'))
      chunks.push(chunk)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (failure) reject(failure)
      else if (code !== 0) reject(new Error(`piper saiu com código ${code}`))
      else resolve(Buffer.concat(chunks))
    })
    // Uma linha só: o Piper fala cada linha como uma frase separada.
    child.stdin?.on('error', () => {})
    child.stdin?.end(`${text.replace(/\s+/g, ' ').trim()}\n`)
  })
}

export function createPiperSynth(deps: PiperSynthDeps): PiperSynth {
  let last: Promise<unknown> = Promise.resolve()
  return (paths, text) => {
    const run = last.then(() => runPiper(deps, paths, text))
    last = run.catch(() => {})
    return run
  }
}
