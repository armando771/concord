import { create } from 'zustand'
import {
  moveLeaf,
  presetLayout,
  resizeSizes,
  syncLayout,
  updateSplitAt,
  type DropSide,
  type LayoutNode,
  type LayoutPreset
} from '../lib/streamLayout'

const PRESET_KEY = 'concord:stream-layout-preset'
const PRESETS: LayoutPreset[] = ['grid', 'row', 'column', 'focus']

// O formato preferido fica salvo neste computador; o arranjo em si depende de
// quem está transmitindo e vale só para a chamada atual.
function loadPreset(): LayoutPreset {
  try {
    const saved = localStorage.getItem(PRESET_KEY) as LayoutPreset | null
    return saved && PRESETS.includes(saved) ? saved : 'grid'
  } catch {
    return 'grid'
  }
}

function savePreset(preset: LayoutPreset): void {
  try {
    localStorage.setItem(PRESET_KEY, preset)
  } catch {
    // Sem armazenamento (modo privado etc.): só não lembra da escolha.
  }
}

interface StreamLayoutState {
  layout: LayoutNode | null
  preset: LayoutPreset
  /** Acompanha quem está transmitindo, preservando o arranjo. */
  sync: (ids: string[]) => void
  applyPreset: (preset: LayoutPreset, ids: string[], focusId?: string | null) => void
  move: (draggedId: string, targetId: string, side: DropSide) => void
  /** Arrasta a divisória `divider` da divisão em `path`. */
  resize: (path: number[], divider: number, delta: number, mins: number[]) => void
  /** Duplo clique na divisória: deixa os blocos daquela divisão iguais. */
  equalize: (path: number[]) => void
}

export const useStreamLayoutStore = create<StreamLayoutState>()((set, get) => ({
  layout: null,
  preset: loadPreset(),

  sync: (ids) => {
    const { layout, preset } = get()
    set({ layout: syncLayout(layout, ids, preset) })
  },

  applyPreset: (preset, ids, focusId) => {
    savePreset(preset)
    set({ preset, layout: presetLayout(preset, ids, focusId) })
  },

  move: (draggedId, targetId, side) => {
    set((state) => ({ layout: moveLeaf(state.layout, draggedId, targetId, side) }))
  },

  resize: (path, divider, delta, mins) => {
    set((state) => ({
      layout: state.layout
        ? updateSplitAt(state.layout, path, (split) => ({
            ...split,
            sizes: resizeSizes(split.sizes, divider, delta, mins)
          }))
        : null
    }))
  },

  equalize: (path) => {
    set((state) => ({
      layout: state.layout
        ? updateSplitAt(state.layout, path, (split) => ({
            ...split,
            sizes: split.sizes.map(() => 1 / split.sizes.length)
          }))
        : null
    }))
  }
}))
