// Voz do /tts no app desktop do Linux (docs/adr/0014-voz-piper-no-linux.md):
// o renderer pede a fala pelo IPC; o main baixa a voz no primeiro uso
// (voiceInstaller.ts) e sintetiza com o Piper (piperSynth.ts). Windows e
// macOS não registram nada e seguem na Web Speech API.
import { spawn } from 'child_process'
import { app, ipcMain, net, type BrowserWindow } from 'electron'
import { join } from 'path'
import { TTS_SPEAK_MAX_CHARS } from '../../shared/ttsVoice'
import { extractTarGz } from '../app/tarGz'
import { piperAssetsFor } from './piperAssets'
import { createPiperSynth, type PiperSynth } from './piperSynth'
import { createVoiceInstaller, type VoiceInstaller } from './voiceInstaller'

export interface TTSDeps {
  installer: VoiceInstaller
  synth: PiperSynth
  log?: (message: string, error: unknown) => void
}

function validText(text: unknown): text is string {
  return typeof text === 'string' && text.trim() !== '' && text.length <= TTS_SPEAK_MAX_CHARS
}

export interface TTSHandlers {
  prepare: () => void
  /** WAV da fala, ou null (voz ainda não pronta, texto inválido, falhou). */
  speak: (text: unknown) => Promise<Uint8Array | null>
}

export function ttsHandlers(deps: TTSDeps): TTSHandlers {
  const { installer } = deps
  const log = deps.log ?? ((message, error) => console.error(`[tts] ${message}:`, error))
  const prepare = (): void => {
    installer.ensure().catch((error) => log('voz não baixou', error))
  }
  return {
    prepare,
    async speak(text: unknown): Promise<Uint8Array | null> {
      if (!validText(text)) return null
      const { status } = installer.state()
      // Primeira fala: baixa e esta fica só no chat. Erro só volta a baixar
      // pelo "Tentar de novo" (ou ao reabrir o app), sem insistir a cada mensagem.
      if (status === 'idle') prepare()
      if (status !== 'ready') return null
      try {
        return new Uint8Array(await deps.synth(await installer.ensure(), text))
      } catch (error) {
        log('síntese falhou', error)
        return null
      }
    }
  }
}

function defaultDeps(): TTSDeps {
  return {
    installer: createVoiceInstaller({
      root: join(app.getPath('userData'), 'tts'),
      assets: piperAssetsFor(process.arch),
      fetch: (url) => net.fetch(url),
      extract: extractTarGz
    }),
    synth: createPiperSynth({ spawn })
  }
}

/** Registra o IPC da voz no Linux. false = outra plataforma (nada registrado). */
export function setupTTS(
  getWindow: () => BrowserWindow | null,
  platform: NodeJS.Platform = process.platform,
  deps?: TTSDeps
): boolean {
  if (platform !== 'linux') return false
  const resolved = deps ?? defaultDeps()
  const handlers = ttsHandlers(resolved)
  resolved.installer.onState((state) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('tts:voice-state', state)
  })
  ipcMain.handle('tts:voice-state', () => resolved.installer.state())
  ipcMain.on('tts:voice-prepare', () => handlers.prepare())
  ipcMain.handle('tts:speak', (_event, text: unknown) => handlers.speak(text))
  return true
}
