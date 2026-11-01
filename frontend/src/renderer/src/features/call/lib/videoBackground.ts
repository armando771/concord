/** Fundo da câmera (como no Discord): nenhum, desfocado ou uma imagem. */
export type BackgroundMode = 'none' | 'blur' | 'image'

export interface BackgroundImageRef {
  kind: 'preset' | 'custom'
  id: string
}

export interface VideoBackground {
  mode: BackgroundMode
  /** Imagem do modo `image` (pronta do app ou enviada pelo usuário). */
  image: BackgroundImageRef | null
}

/**
 * Imagem enviada pelo usuário: JPEG já reduzido (data URL) ou GIF animado. O GIF
 * é grande demais para o localStorage: o arquivo fica no IndexedDB e `dataUrl`
 * é só um blob: da sessão (vazio até carregar).
 */
export interface CustomBackground {
  id: string
  dataUrl: string
  animated?: boolean
  /** O arquivo do GIF (só na sessão): os quadros saem dele. Nunca é salvo no localStorage. */
  blob?: Blob
}

/** Imagem pronta que vem com o app. */
export interface BackgroundPreset {
  id: string
  label: string
  dataUrl: string
}

export const DEFAULT_VIDEO_BACKGROUND: VideoBackground = { mode: 'none', image: null }

/** Limite de imagens salvas: cada uma ocupa o localStorage (~5 MB no total). */
export const MAX_CUSTOM_BACKGROUNDS = 5

const PRESET_LABELS: Record<string, string> = {
  aurora: 'Aurora',
  'cidade-neon': 'Cidade neon',
  'por-do-sol': 'Pôr do sol',
  espaco: 'Espaço',
  floresta: 'Floresta',
  oceano: 'Oceano',
  estante: 'Estante',
  estudio: 'Estúdio'
}

// ?inline: data URL. Imagem carregada de file:// (app empacotado) contamina o
// canvas e quebra o captureStream; data URL não.
const files = import.meta.glob('../../../assets/video-backgrounds/*.svg', {
  eager: true,
  query: '?inline',
  import: 'default'
}) as Record<string, string>

export const PRESET_BACKGROUNDS: BackgroundPreset[] = Object.entries(files)
  .map(([path, dataUrl]) => {
    const id = path
      .split('/')
      .pop()!
      .replace(/\.svg$/, '')
    return { id, label: PRESET_LABELS[id] ?? id, dataUrl }
  })
  .sort((a, b) => a.id.localeCompare(b.id))

const MODES: readonly BackgroundMode[] = ['none', 'blur', 'image']

export function sanitizeBackground(raw: unknown): VideoBackground {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_VIDEO_BACKGROUND }
  const r = raw as Record<string, unknown>
  const mode = MODES.includes(r.mode as BackgroundMode) ? (r.mode as BackgroundMode) : 'none'
  const ref = r.image && typeof r.image === 'object' ? (r.image as Record<string, unknown>) : null
  const image: BackgroundImageRef | null =
    ref && (ref.kind === 'preset' || ref.kind === 'custom') && typeof ref.id === 'string' && ref.id
      ? { kind: ref.kind, id: ref.id }
      : null
  // Imagem sem imagem escolhida não tem o que mostrar.
  return { mode: mode === 'image' && !image ? 'none' : mode, image }
}

export function sanitizeCustomBackgrounds(raw: unknown): CustomBackground[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: CustomBackground[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { id, dataUrl, animated } = item as Record<string, unknown>
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    if (animated === true) {
      // O GIF mesmo está no IndexedDB; aqui só o registro (o blob: é da sessão).
      seen.add(id)
      out.push({ id, dataUrl: '', animated: true })
    } else {
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue
      seen.add(id)
      out.push({ id, dataUrl })
    }
    if (out.length === MAX_CUSTOM_BACKGROUNDS) break
  }
  return out
}

/** Data URL da imagem escolhida; null se sumiu (ex.: imagem salva apagada). */
export function resolveBackgroundImage(
  bg: VideoBackground,
  customs: readonly CustomBackground[],
  presets: readonly BackgroundPreset[] = PRESET_BACKGROUNDS
): string | null {
  if (bg.mode !== 'image' || !bg.image) return null
  const list = bg.image.kind === 'preset' ? presets : customs
  const found = list.find((i) => i.id === bg.image!.id)
  // GIF ainda carregando do IndexedDB: dataUrl vazio = sem imagem por enquanto.
  return found?.dataUrl || null
}

/** O fundo pronto para o pipeline: modo, imagem (identifica) e, se GIF, o arquivo. */
export function resolveBackgroundEffect(
  bg: VideoBackground,
  customs: readonly CustomBackground[],
  presets: readonly BackgroundPreset[] = PRESET_BACKGROUNDS
): { mode: BackgroundMode; image: string | null; blob: Blob | null } {
  const image = resolveBackgroundImage(bg, customs, presets)
  const blob =
    image && bg.image?.kind === 'custom'
      ? (customs.find((c) => c.id === bg.image?.id)?.blob ?? null)
      : null
  return { mode: bg.mode, image, blob }
}

/** O efeito exige processar o vídeo (e portanto o pipeline). */
export function needsPipeline(
  bg: VideoBackground,
  customs: readonly CustomBackground[],
  presets: readonly BackgroundPreset[] = PRESET_BACKGROUNDS
): boolean {
  if (bg.mode === 'blur') return true
  return bg.mode === 'image' && resolveBackgroundImage(bg, customs, presets) !== null
}

/** Mesma imagem escolhida? (compara só o que importa para o vídeo). */
export function sameBackground(a: VideoBackground, b: VideoBackground): boolean {
  return a.mode === b.mode && a.image?.kind === b.image?.kind && a.image?.id === b.image?.id
}
