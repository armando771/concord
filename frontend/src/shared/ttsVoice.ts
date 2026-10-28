// Estado da voz do /tts baixada no primeiro uso (só app desktop no Linux,
// docs/adr/0014-voz-piper-no-linux.md). Compartilhado por main, preload e renderer.

export type TTSVoiceState =
  /** Ainda não baixada: baixa na primeira mensagem /tts (ou ao ligar o interruptor). */
  | { status: 'idle' }
  | { status: 'downloading'; percent: number }
  | { status: 'ready' }
  /** Download ou verificação falhou depois das novas tentativas. */
  | { status: 'error' }
  /** Processador sem binário do Piper (só x86_64 e aarch64). */
  | { status: 'unsupported' }

/** Maior texto aceito para sintetizar (a mensagem /tts tem até 200 caracteres, mais o nome). */
export const TTS_SPEAK_MAX_CHARS = 400
