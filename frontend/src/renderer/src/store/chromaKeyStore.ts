import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_CHROMA_KEY,
  sanitizeChromaKey,
  type ChromaKeyBackground,
  type ChromaKeySettings
} from '../lib/chromaKey'

interface ChromaKeyState extends ChromaKeySettings {
  setEnabled: (enabled: boolean) => void
  setKeyColor: (color: string) => void
  setSimilarity: (v: number) => void
  setSmoothness: (v: number) => void
  setBackground: (bg: Partial<ChromaKeyBackground>) => void
}

/** Só os campos de configuração (sem as funções), já validados. */
export function chromaKeySettings(s: ChromaKeySettings): ChromaKeySettings {
  return sanitizeChromaKey(s)
}

// Sem window (testes em node) o store só não persiste.
const ls = (): Storage | undefined =>
  typeof window !== 'undefined' ? window.localStorage : undefined

export const useChromaKeyStore = create<ChromaKeyState>()(
  persist(
    (set) => ({
      ...DEFAULT_CHROMA_KEY,
      setEnabled: (enabled) => set({ enabled }),
      setKeyColor: (keyColor) => set((s) => sanitizeChromaKey({ ...s, keyColor })),
      setSimilarity: (similarity) => set((s) => sanitizeChromaKey({ ...s, similarity })),
      setSmoothness: (smoothness) => set((s) => sanitizeChromaKey({ ...s, smoothness })),
      setBackground: (bg) =>
        set((s) => sanitizeChromaKey({ ...s, background: { ...s.background, ...bg } }))
    }),
    {
      name: 'concord-chroma-key',
      // A imagem de fundo pode estourar a quota: perder o salvamento é melhor
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
      partialize: (s) => chromaKeySettings(s),
      // Valida o que veio do disco: valor corrompido volta ao padrão.
      merge: (persisted, current) => ({ ...current, ...sanitizeChromaKey(persisted) })
    }
  )
)
