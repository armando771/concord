import { createHash } from 'crypto'
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { Readable } from 'stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TTSVoiceState } from '../../shared/ttsVoice'
import { PIPER_BUNDLE, TTS_READY_FILE, TTS_STAGING_PREFIX, type PiperAsset } from './piperAssets'
import { createVoiceInstaller, type VoiceInstallerDeps } from './voiceInstaller'

let root: string
beforeEach(() => {
  root = join(mkdtempSync(join(tmpdir(), 'tts-inst-')), 'tts')
})
afterEach(() => rmSync(join(root, '..'), { recursive: true, force: true }))

const files: Record<string, Buffer> = {
  'piper.tar.gz': Buffer.from('tar falso'),
  'pt_BR-faber-medium.onnx': Buffer.from('modelo'),
  'pt_BR-faber-medium.onnx.json': Buffer.from('{}')
}
const assets: PiperAsset[] = Object.entries(files).map(([name, data]) => ({
  name,
  url: `https://x/${name}`,
  sha256: createHash('sha256').update(data).digest('hex'),
  size: data.length,
  extract: name.endsWith('.tar.gz')
}))
const serve = async (url: string): Promise<Response> =>
  new Response(new Uint8Array(files[url.replace('https://x/', '')]))

/** "Extrai" o tar falso (lê tudo, como o tar): cria piper/piper sem marca de executável. */
const fakeExtract = async (src: Readable, dest: string): Promise<void> => {
  for await (const _chunk of src) void _chunk
  mkdirSync(join(dest, 'piper'), { recursive: true })
  writeFileSync(join(dest, 'piper', 'piper'), '#!/bin/sh\n')
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- dublê de teste
function make(over: Partial<VoiceInstallerDeps> = {}) {
  const states: TTSVoiceState[] = []
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {})
  const fetch = vi.fn(serve)
  const installer = createVoiceInstaller({
    root,
    assets,
    fetch,
    extract: fakeExtract,
    sleep,
    pid: 42,
    ...over
  })
  installer.onState((s) => states.push(s))
  return { installer, states, sleep, fetch: (over.fetch as typeof fetch) ?? fetch }
}

const finalDir = (): string => join(root, PIPER_BUNDLE)

describe('voiceInstaller', () => {
  it('baixa, extrai, marca o binário como executável e fica pronta', async () => {
    const { installer, states } = make()
    expect(installer.state()).toEqual({ status: 'idle' })
    const paths = await installer.ensure()
    expect(paths.binary).toBe(join(finalDir(), 'piper', 'piper'))
    expect(() => accessSync(paths.binary, constants.X_OK)).not.toThrow()
    expect(existsSync(join(finalDir(), 'piper.tar.gz'))).toBe(false)
    expect(existsSync(join(finalDir(), TTS_READY_FILE))).toBe(true)
    expect(states[0]).toEqual({ status: 'downloading', percent: 0 })
    expect(states).toContainEqual({ status: 'downloading', percent: 100 })
    expect(states.at(-1)).toEqual({ status: 'ready' })
    expect(installer.state()).toEqual({ status: 'ready' })
  })

  it('sha256 errado: tenta de novo com espera crescente e termina em erro, sem deixar nada', async () => {
    const bad = assets.map((a) => ({ ...a, sha256: '0'.repeat(64) }))
    const { installer, sleep, fetch } = make({ assets: bad })
    await expect(installer.ensure()).rejects.toThrow('sha256')
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 8000])
    expect(installer.state()).toEqual({ status: 'error' })
    expect(readdirSync(root)).toEqual([])
  })

  it('falha de rede passageira: a nova tentativa resolve', async () => {
    let calls = 0
    const fetch = vi.fn(async (url: string) => {
      if (calls++ === 0) throw new Error('rede caiu')
      return serve(url)
    })
    const { installer, sleep } = make({ fetch })
    await installer.ensure()
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(installer.state()).toEqual({ status: 'ready' })
  })

  it('um download por vez: pedidos juntos esperam o mesmo', async () => {
    const { installer, fetch } = make()
    const [a, b] = await Promise.all([installer.ensure(), installer.ensure()])
    expect(a).toEqual(b)
    expect(fetch).toHaveBeenCalledTimes(assets.length)
  })

  it('atômico: enquanto baixa, a pasta da versão não existe', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const fetch = vi.fn(async (url: string) => {
      await gate
      return serve(url)
    })
    const { installer } = make({ fetch })
    const done = installer.ensure()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(existsSync(finalDir())).toBe(false)
    expect(readdirSync(root)).toEqual([`${TTS_STAGING_PREFIX}${PIPER_BUNDLE}-42`])
    release()
    await done
    expect(readdirSync(root)).toEqual([PIPER_BUNDLE])
  })

  it('já baixada: pronta desde o início, sem download, e limpa versões antigas', async () => {
    mkdirSync(join(finalDir(), 'piper'), { recursive: true })
    writeFileSync(join(finalDir(), 'piper', 'piper'), '', { mode: 0o755 })
    writeFileSync(join(finalDir(), 'pt_BR-faber-medium.onnx'), '')
    writeFileSync(join(finalDir(), TTS_READY_FILE), '')
    mkdirSync(join(root, 'piper-velho'))
    mkdirSync(join(root, `${TTS_STAGING_PREFIX}${PIPER_BUNDLE}-7`))
    const { installer, fetch } = make()
    expect(installer.state()).toEqual({ status: 'ready' })
    await installer.ensure()
    expect(fetch).not.toHaveBeenCalled()
    expect(readdirSync(root)).toEqual([PIPER_BUNDLE])
  })

  it('pasta da versão incompleta (sem a marca de pronta) é baixada de novo', async () => {
    mkdirSync(join(finalDir(), 'piper'), { recursive: true })
    const { installer, fetch } = make()
    expect(installer.state()).toEqual({ status: 'idle' })
    await installer.ensure()
    expect(fetch).toHaveBeenCalledTimes(assets.length)
    expect(installer.state()).toEqual({ status: 'ready' })
  })

  it('processador sem Piper: sem suporte e nada é baixado', async () => {
    const { installer, fetch } = make({ assets: null })
    expect(installer.state()).toEqual({ status: 'unsupported' })
    await expect(installer.ensure()).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('depois do erro, ensure tenta de novo (botão "Tentar de novo")', async () => {
    let fail = true
    const fetch = vi.fn(async (url: string) => {
      if (fail) throw new Error('offline')
      return serve(url)
    })
    const { installer } = make({ fetch })
    await expect(installer.ensure()).rejects.toThrow('offline')
    fail = false
    await installer.ensure()
    expect(installer.state()).toEqual({ status: 'ready' })
  })
})
