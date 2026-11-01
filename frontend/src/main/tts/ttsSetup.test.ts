import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TTSVoiceState } from '../../shared/ttsVoice'
import type { VoiceInstaller } from './voiceInstaller'

const electron = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  listeners: new Map<string, (...args: unknown[]) => unknown>()
}))
vi.mock('electron', () => ({
  app: { getPath: () => '/nao/usado' },
  net: { fetch: vi.fn() },
  ipcMain: {
    handle: (ch: string, fn: (...a: unknown[]) => unknown) => electron.handlers.set(ch, fn),
    on: (ch: string, fn: (...a: unknown[]) => unknown) => electron.listeners.set(ch, fn)
  }
}))

import { setupTTS, ttsHandlers } from './ttsSetup'

const paths = { binary: '/v/piper/piper', model: '/v/m.onnx' }

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- dublê de teste
function fakeInstaller(status: TTSVoiceState['status']) {
  let state = { status } as TTSVoiceState
  return {
    state: () => state,
    onState: vi.fn(),
    ensure: vi.fn(async () => {
      state = { status: 'ready' }
      return paths
    })
  } satisfies VoiceInstaller
}

describe('ttsHandlers.speak', () => {
  it('voz pronta: devolve o WAV sintetizado', async () => {
    const synth = vi.fn(async () => Buffer.from('RIFF'))
    const h = ttsHandlers({ installer: fakeInstaller('ready'), synth })
    const wav = await h.speak('Ana disse: oi')
    expect(Buffer.from(wav!).toString()).toBe('RIFF')
    expect(synth).toHaveBeenCalledWith(paths, 'Ana disse: oi')
  })

  it('primeira fala: começa a baixar e não fala (fica só no chat)', async () => {
    const installer = fakeInstaller('idle')
    const synth = vi.fn()
    expect(await ttsHandlers({ installer, synth }).speak('oi')).toBeNull()
    expect(installer.ensure).toHaveBeenCalledTimes(1)
    expect(synth).not.toHaveBeenCalled()
  })

  it('baixando ou com erro: não fala nem baixa de novo sozinho', async () => {
    for (const status of ['downloading', 'error', 'unsupported'] as const) {
      const installer = fakeInstaller(status)
      expect(await ttsHandlers({ installer, synth: vi.fn() }).speak('oi')).toBeNull()
      expect(installer.ensure).not.toHaveBeenCalled()
    }
  })

  it('texto inválido (não string, vazio, longo demais): null', async () => {
    const synth = vi.fn()
    const h = ttsHandlers({ installer: fakeInstaller('ready'), synth })
    expect(await h.speak(42)).toBeNull()
    expect(await h.speak('   ')).toBeNull()
    expect(await h.speak('a'.repeat(401))).toBeNull()
    expect(synth).not.toHaveBeenCalled()
  })

  it('síntese falhou: null (a fila segue)', async () => {
    const synth = vi.fn(async () => {
      throw new Error('piper saiu com código 1')
    })
    const h = ttsHandlers({ installer: fakeInstaller('ready'), synth, log: () => {} })
    expect(await h.speak('oi')).toBeNull()
  })

  it('prepare baixa (ligou o interruptor ou "Tentar de novo")', async () => {
    const installer = fakeInstaller('error')
    ttsHandlers({ installer, synth: vi.fn() }).prepare()
    expect(installer.ensure).toHaveBeenCalledTimes(1)
  })
})

describe('setupTTS', () => {
  beforeEach(() => {
    electron.handlers.clear()
    electron.listeners.clear()
  })

  it('Windows e macOS: nada registrado (continua a Web Speech)', () => {
    expect(setupTTS(() => null, 'win32')).toBe(false)
    expect(setupTTS(() => null, 'darwin')).toBe(false)
    expect(electron.handlers.size + electron.listeners.size).toBe(0)
  })

  it('Linux: estado, preparar e falar pelo IPC, estado novo vai para a janela', () => {
    const send = vi.fn()
    const installer = fakeInstaller('idle')
    const win = { isDestroyed: () => false, webContents: { send } }
    expect(setupTTS(() => win as never, 'linux', { installer, synth: vi.fn() })).toBe(true)
    expect([...electron.handlers.keys()].sort()).toEqual(['tts:speak', 'tts:voice-state'])
    expect([...electron.listeners.keys()]).toEqual(['tts:voice-prepare'])
    expect(electron.handlers.get('tts:voice-state')!()).toEqual({ status: 'idle' })
    const onState = installer.onState.mock.calls[0][0] as (s: TTSVoiceState) => void
    onState({ status: 'downloading', percent: 3 })
    expect(send).toHaveBeenCalledWith('tts:voice-state', { status: 'downloading', percent: 3 })
  })
})
