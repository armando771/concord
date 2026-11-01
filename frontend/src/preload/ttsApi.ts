import { ipcRenderer } from 'electron'
import type { TTSVoiceState } from '../shared/ttsVoice'

// window.api.tts: voz do /tts baixada no primeiro uso, só no Linux (main/tts).
export const ttsApi = {
  voiceState(): Promise<TTSVoiceState> {
    return ipcRenderer.invoke('tts:voice-state')
  },
  prepare(): void {
    ipcRenderer.send('tts:voice-prepare')
  },
  speak(text: string): Promise<Uint8Array | null> {
    return ipcRenderer.invoke('tts:speak', text)
  },
  onVoiceState(cb: (state: TTSVoiceState) => void): () => void {
    const listener = (_e: unknown, state: TTSVoiceState): void => cb(state)
    ipcRenderer.on('tts:voice-state', listener)
    return () => ipcRenderer.removeListener('tts:voice-state', listener)
  }
}
