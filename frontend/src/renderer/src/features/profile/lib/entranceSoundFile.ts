// Regras do arquivo do som de entrada (as mesmas do backend: user/entrance_sound.go).

export const MAX_ENTRANCE_SOUND_BYTES = 2 * 1024 * 1024
export const MIN_ENTRANCE_SOUND_MS = 100
export const MAX_ENTRANCE_SOUND_MS = 5_000

/** Tipos do seletor de arquivo (os áudios que a mesa de áudio também aceita). */
export const ENTRANCE_SOUND_ACCEPT =
  'audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,audio/webm,.mp3,.wav,.ogg,.m4a,.webm'

const AUDIO_EXTENSION = /\.(mp3|wav|ogg|m4a|webm)$/i

/** Erro do arquivo escolhido (antes de ler a duração), ou null. */
export function entranceSoundFileError(file: File): string | null {
  const isAudio = file.type.startsWith('audio/') || (!file.type && AUDIO_EXTENSION.test(file.name))
  if (!isAudio) return FILE_TYPE_ERROR
  if (file.size > MAX_ENTRANCE_SOUND_BYTES) return 'O som de entrada pode ter até 2 MB.'
  return null
}

/** Erro da duração lida do arquivo, ou null. */
export function entranceSoundDurationError(ms: number | null | undefined): string | null {
  const ok = typeof ms === 'number' && ms >= MIN_ENTRANCE_SOUND_MS && ms <= MAX_ENTRANCE_SOUND_MS
  return ok ? null : 'O som de entrada precisa ter entre 0,1 s e 5 s.'
}

const FILE_TYPE_ERROR = 'Use um áudio MP3, WAV, OGG, M4A ou WebM.'

// O backend responde em inglês: o app mostra a regra em português.
const SERVER_ERRORS: Record<number, string> = {
  400: 'O som de entrada precisa ter entre 0,1 s e 5 s.',
  413: 'O som de entrada pode ter até 2 MB.',
  415: FILE_TYPE_ERROR,
  507: 'O servidor está sem espaço agora. Tente mais tarde.'
}

/** Mensagem para um erro ao salvar ou remover o som. */
export function entranceSoundSaveError(err: unknown, status?: number): string {
  const known = status === undefined ? undefined : SERVER_ERRORS[status]
  if (known) return known
  return err instanceof Error && err.message
    ? err.message
    : 'Não foi possível salvar o som de entrada.'
}

const BUSY_TEXT = { upload: 'Enviando…', remove: 'Removendo…' } as const

/** A linha de situação embaixo dos botões. */
export function entranceSoundStatus(
  busy: keyof typeof BUSY_TEXT | null,
  url: string | null
): string {
  if (busy) return BUSY_TEXT[busy]
  return url ? 'Usando o seu som.' : 'Usando o som padrão.'
}
