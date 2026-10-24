/** Que som vai junto da tela compartilhada. */
export type DisplayAudioMode = 'window' | 'system' | 'none'

/**
 * - janela: só o som do app dela (helper nativo). Se não deu para isolar,
 *   vai SEM som — nunca o do sistema, que vazaria outros apps (YouTube…).
 * - tela inteira: som do sistema sem a Salinha (loopback + restrictOwnAudio).
 * - loopback só existe no Windows.
 */
export function displayAudioMode(input: {
  sourceId: string
  audioRequested: boolean
  platform: NodeJS.Platform
  windowAudioOk: boolean
}): DisplayAudioMode {
  if (!input.audioRequested || input.platform !== 'win32') return 'none'
  if (input.sourceId.startsWith('window:')) return input.windowAudioOk ? 'window' : 'none'
  return 'system'
}
