// Baixa e prepara a voz do /tts no Linux no primeiro uso
// (docs/adr/0014-voz-piper-no-linux.md):
//
//   <userData>/tts/<PIPER_BUNDLE>/          piper/ (binário + libs), modelo, "pronto"
//   <userData>/tts/.staging-<bundle>-<pid>/ download em andamento
//
// Um download por vez (pedidos juntos esperam o mesmo), novas tentativas com
// espera crescente, tudo conferido (verifiedDownload.ts) numa pasta temporária
// que só vira a da versão no fim (rename). Versões antigas são apagadas.
import {
  accessSync,
  chmodSync,
  constants,
  createReadStream,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import type { Readable } from 'stream'
import type { TTSVoiceState } from '../../shared/ttsVoice'
import {
  PIPER_BUNDLE,
  TTS_READY_FILE,
  TTS_STAGING_PREFIX,
  piperPaths,
  ttsDirsToPrune,
  type PiperAsset
} from './piperAssets'
import { downloadVerified, type Fetch } from './verifiedDownload'

export type PiperPaths = ReturnType<typeof piperPaths>

export interface VoiceInstallerDeps {
  /** <userData>/tts */
  root: string
  /** piperAssetsFor(process.arch); null = processador sem Piper */
  assets: PiperAsset[] | null
  fetch: Fetch
  extract: (source: Readable, dest: string) => Promise<void>
  sleep?: (ms: number) => Promise<void>
  pid?: number
}

export interface VoiceInstaller {
  state: () => TTSVoiceState
  onState: (cb: (state: TTSVoiceState) => void) => void
  /** Caminhos da voz pronta, baixando antes se precisar. */
  ensure: () => Promise<PiperPaths>
}

/** Espera antes da 2ª e da 3ª tentativa. */
const BACKOFF_MS = [2000, 8000]

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function isReady(dir: string): boolean {
  const { binary, model } = piperPaths(dir)
  try {
    accessSync(join(dir, TTS_READY_FILE))
    accessSync(model)
    accessSync(binary, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function prune(root: string, pid: number): void {
  try {
    for (const name of ttsDirsToPrune(readdirSync(root), pid)) {
      rmSync(join(root, name), { recursive: true, force: true })
    }
  } catch {
    // sem pasta ainda: nada a limpar
  }
}

export function createVoiceInstaller(deps: VoiceInstallerDeps): VoiceInstaller {
  const { root, assets } = deps
  const pid = deps.pid ?? process.pid
  const sleep = deps.sleep ?? defaultSleep
  const final = join(root, PIPER_BUNDLE)
  const listeners: Array<(state: TTSVoiceState) => void> = []
  let current: TTSVoiceState = !assets
    ? { status: 'unsupported' }
    : isReady(final)
      ? { status: 'ready' }
      : { status: 'idle' }
  let inflight: Promise<PiperPaths> | null = null

  const set = (next: TTSVoiceState): void => {
    current = next
    listeners.forEach((cb) => cb(next))
  }

  async function install(list: PiperAsset[]): Promise<void> {
    const staging = join(root, `${TTS_STAGING_PREFIX}${PIPER_BUNDLE}-${pid}`)
    const total = list.reduce((n, a) => n + a.size, 0)
    let received = 0
    let percent = 0
    const onBytes = (bytes: number): void => {
      received += bytes
      const next = Math.floor((received / total) * 100)
      if (next !== percent) set({ status: 'downloading', percent: (percent = next) })
    }
    rmSync(staging, { recursive: true, force: true })
    mkdirSync(staging, { recursive: true })
    try {
      for (const asset of list) {
        const file = join(staging, asset.name)
        await downloadVerified(deps.fetch, asset, file, onBytes)
        if (!asset.extract) continue
        await deps.extract(createReadStream(file), staging)
        rmSync(file)
      }
      chmodSync(piperPaths(staging).binary, 0o755)
      writeFileSync(join(staging, TTS_READY_FILE), `${PIPER_BUNDLE}\n`)
      rmSync(final, { recursive: true, force: true })
      renameSync(staging, final)
    } catch (error) {
      rmSync(staging, { recursive: true, force: true })
      throw error
    }
  }

  async function run(list: PiperAsset[]): Promise<PiperPaths> {
    for (let attempt = 0; ; attempt++) {
      set({ status: 'downloading', percent: 0 })
      try {
        await install(list)
        break
      } catch (error) {
        if (attempt >= BACKOFF_MS.length) {
          set({ status: 'error' })
          throw error
        }
        await sleep(BACKOFF_MS[attempt])
      }
    }
    prune(root, pid)
    set({ status: 'ready' })
    return piperPaths(final)
  }

  if (current.status === 'ready') prune(root, pid)

  return {
    state: () => current,
    onState: (cb) => void listeners.push(cb),
    ensure() {
      if (!assets) return Promise.reject(new Error('processador sem voz do Piper'))
      if (current.status === 'ready' && isReady(final)) return Promise.resolve(piperPaths(final))
      inflight ??= run(assets).finally(() => (inflight = null))
      return inflight
    }
  }
}
