// Quem desenha o overlay de jogo: a janela nativa do helper (Windows) ou a
// janela do Electron (Linux/macOS, helper ausente, nativo que falhou, ou a
// preferência de comparação). Puro para testar.

export type OverlayRenderer = 'native' | 'electron'

const FLAG = '--overlay='

function asRenderer(value: string | undefined): OverlayRenderer | null {
  const v = value?.trim().toLowerCase()
  return v === 'native' || v === 'electron' ? v : null
}

/**
 * Preferência para comparar os dois: `--overlay=electron|native` no argv (vence)
 * ou `SALINHA_OVERLAY=electron|native`. null = sem preferência (o padrão).
 */
export function overlayRendererFlag(
  argv: readonly string[],
  env: Record<string, string | undefined>
): OverlayRenderer | null {
  const arg = argv.find((a) => a.startsWith(FLAG))
  if (arg) return asRenderer(arg.slice(FLAG.length))
  return asRenderer(env.SALINHA_OVERLAY)
}

export interface OverlayRendererInput {
  platform: NodeJS.Platform
  /** O concord-audio.exe está no lugar. */
  helperExists: boolean
  forced: OverlayRenderer | null
  /** O nativo já falhou nesta sessão (não tenta de novo até reabrir o app). */
  nativeFailed: boolean
}

export function chooseOverlayRenderer(input: OverlayRendererInput): OverlayRenderer {
  if (input.platform !== 'win32' || input.forced === 'electron') return 'electron'
  return input.helperExists && !input.nativeFailed ? 'native' : 'electron'
}
