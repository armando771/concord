import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_VIDEO_BACKGROUND,
  MAX_CUSTOM_BACKGROUNDS,
  sanitizeBackground,
  sanitizeCustomBackgrounds,
  type CustomBackground,
  type VideoBackground
} from '../lib/videoBackground'
import { gifStorage } from '../lib/gifStorage'

interface VideoSettingsState {
  /** Câmera escolhida ('' = padrão do sistema). */
  cameraId: string
  /** Mostra a prévia do vídeo antes de ligar a câmera numa chamada. */
  alwaysPreview: boolean
  background: VideoBackground
  /** Imagens enviadas pelo usuário (as mais novas primeiro). */
  customs: CustomBackground[]
  setCameraId: (id: string) => void
  setAlwaysPreview: (on: boolean) => void
  setBackground: (bg: VideoBackground) => void
  /**
   * Guarda a imagem e devolve o id; `select` (padrão) também a escolhe como fundo.
   * Passou do limite: a mais antiga sai.
   */
  addCustom: (dataUrl: string, select?: boolean) => string
  /**
   * Como addCustom, para um GIF animado: o arquivo vai para o IndexedDB.
   * Se não der para guardar, rejeita e nada muda.
   */
  addCustomGif: (blob: Blob, select?: boolean) => Promise<string>
  removeCustom: (id: string) => void
}

type Settings = Pick<VideoSettingsState, 'cameraId' | 'alwaysPreview' | 'background' | 'customs'>

export function sanitizeVideoSettings(raw: unknown): Settings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const customs = sanitizeCustomBackgrounds(r.customs)
  const background = sanitizeBackground(r.background)
  // Escolheu uma imagem salva que não existe mais: volta para "nenhum".
  const orphan =
    background.mode === 'image' &&
    background.image?.kind === 'custom' &&
    !customs.some((c) => c.id === background.image?.id)
  return {
    cameraId: typeof r.cameraId === 'string' ? r.cameraId : '',
    alwaysPreview: r.alwaysPreview === true,
    background: orphan ? { ...DEFAULT_VIDEO_BACKGROUND } : background,
    customs
  }
}

// Sem window (testes em node) o store só não persiste.
const ls = (): Storage | undefined =>
  typeof window !== 'undefined' ? window.localStorage : undefined

// Chroma key (v0.6.x): saiu do app. Apaga o que ficou salvo.
try {
  ls()?.removeItem('concord-chroma-key')
} catch {
  /* storage bloqueado */
}

/** Solta o que os GIFs tirados da lista ocupavam (blob: da sessão e arquivo do IndexedDB). */
function disposeGifs(removed: readonly CustomBackground[]): void {
  for (const c of removed) {
    if (!c.animated) continue
    if (c.dataUrl.startsWith('blob:')) URL.revokeObjectURL(c.dataUrl)
    void gifStorage.delete(c.id).catch(() => {})
  }
}

let nextId = 0
const newId = (): string => `${Date.now().toString(36)}-${(nextId++).toString(36)}`

export const useVideoSettingsStore = create<VideoSettingsState>()(
  persist(
    (set, get) => ({
      cameraId: '',
      alwaysPreview: false,
      background: { ...DEFAULT_VIDEO_BACKGROUND },
      customs: [],
      setCameraId: (cameraId) => set({ cameraId }),
      setAlwaysPreview: (alwaysPreview) => set({ alwaysPreview }),
      setBackground: (background) => set({ background: sanitizeBackground(background) }),
      addCustom: (dataUrl, select = true) => {
        const existing = get().customs.find((c) => c.dataUrl === dataUrl)
        const id = existing?.id ?? newId()
        const rest = get().customs.filter((c) => c.id !== id)
        const customs = [{ id, dataUrl }, ...rest].slice(0, MAX_CUSTOM_BACKGROUNDS)
        disposeGifs(get().customs.filter((c) => !customs.some((n) => n.id === c.id)))
        set(
          select
            ? { customs, background: { mode: 'image', image: { kind: 'custom', id } } }
            : { customs }
        )
        return id
      },
      addCustomGif: async (blob, select = true) => {
        const id = newId()
        await gifStorage.put(id, blob)
        const customs = [
          { id, dataUrl: URL.createObjectURL(blob), animated: true, blob },
          ...get().customs
        ].slice(0, MAX_CUSTOM_BACKGROUNDS)
        disposeGifs(get().customs.filter((c) => !customs.some((n) => n.id === c.id)))
        set(
          select
            ? { customs, background: { mode: 'image', image: { kind: 'custom', id } } }
            : { customs }
        )
        return id
      },
      removeCustom: (id) => {
        const { background, customs } = get()
        const selected = background.image?.kind === 'custom' && background.image.id === id
        disposeGifs(customs.filter((c) => c.id === id))
        set({
          customs: customs.filter((c) => c.id !== id),
          background: selected ? { ...DEFAULT_VIDEO_BACKGROUND } : background
        })
      }
    }),
    {
      name: 'concord-video',
      // Imagens grandes podem estourar a quota: perder o salvamento é melhor
      // que quebrar o ajuste (a configuração segue valendo na sessão).
      storage: createJSONStorage(() => ({
        getItem: (k) => ls()?.getItem(k) ?? null,
        removeItem: (k) => ls()?.removeItem(k),
        setItem: (k, v) => {
          try {
            ls()?.setItem(k, v)
          } catch {
            /* quota cheia ou storage bloqueado */
          }
        }
      })),
      partialize: (s): Settings => ({
        cameraId: s.cameraId,
        alwaysPreview: s.alwaysPreview,
        background: s.background,
        // O GIF fica no IndexedDB; o blob: só vale nesta sessão.
        customs: s.customs.map((c) => (c.animated ? { id: c.id, dataUrl: '', animated: true } : c))
      }),
      // Valida o que veio do disco: valor corrompido volta ao padrão.
      merge: (persisted, current) => ({ ...current, ...sanitizeVideoSettings(persisted) })
    }
  )
)

/**
 * GIFs salvos: depois de carregar as configurações, busca os arquivos no
 * IndexedDB e dá a cada um o blob: da sessão. Quem sumiu do banco sai da lista
 * (e, se estava escolhido, o fundo volta para "nenhum").
 */
export async function hydrateGifs(): Promise<void> {
  const pending = useVideoSettingsStore.getState().customs.filter((c) => c.animated && !c.dataUrl)
  if (pending.length === 0) return
  const found = new Map<string, { dataUrl: string; blob: Blob }>()
  await Promise.all(
    pending.map(async (c) => {
      const blob = await gifStorage.get(c.id).catch(() => null)
      if (blob) found.set(c.id, { dataUrl: URL.createObjectURL(blob), blob })
    })
  )
  const { customs, background } = useVideoSettingsStore.getState()
  const kept = customs.flatMap((c) => {
    if (!pending.some((p) => p.id === c.id)) return [c]
    const loaded = found.get(c.id)
    return loaded ? [{ ...c, ...loaded }] : []
  })
  const lost =
    background.image?.kind === 'custom' && !kept.some((c) => c.id === background.image?.id)
  useVideoSettingsStore.setState({
    customs: kept,
    ...(background.mode === 'image' && lost ? { background: { ...DEFAULT_VIDEO_BACKGROUND } } : {})
  })
}

if (typeof indexedDB !== 'undefined') void hydrateGifs()
