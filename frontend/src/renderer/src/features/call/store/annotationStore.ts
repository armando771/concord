import { create } from 'zustand'
import { useChatStore } from '../../chat/store/chatStore'
import { useAuthStore } from '../../auth/store/authStore'

export type AnnotationTool = 'pen' | 'highlighter' | 'laser' | 'eraser'

export interface DrawPoint {
  x: number
  y: number
}

export interface DrawStroke {
  id: string
  sharer_id: string
  user_id: string
  tool: AnnotationTool
  color: string
  width: number
  points: DrawPoint[]
  created_at: number
  fade_out?: boolean
}

export interface AnnotationState {
  tool: AnnotationTool
  color: string
  width: number
  drawingActive: Record<string, boolean>
  strokes: Record<string, DrawStroke[]>
  myStrokeIds: Record<string, string[]>

  setTool: (tool: AnnotationTool) => void
  setColor: (color: string) => void
  setWidth: (width: number) => void
  toggleDrawing: (sharerId: string) => void
  setDrawingActive: (sharerId: string, active: boolean) => void

  addStroke: (
    callId: string,
    sharerId: string,
    stroke: Omit<DrawStroke, 'sharer_id' | 'user_id' | 'created_at'>
  ) => void
  undo: (callId: string, sharerId: string) => void
  clear: (callId: string, sharerId: string) => void
  removeStrokeLocally: (sharerId: string, strokeId: string) => void

  handleWsEvent: (event: { type: string; payload: unknown }) => void
  cleanup: (sharerId?: string) => void
}

export const PRESET_COLORS = [
  '#ef4444', // Red
  '#eab308', // Yellow
  '#22c55e', // Green
  '#38bdf8', // Cyan
  '#a855f7', // Purple
  '#ffffff' // White
]

export const PRESET_WIDTHS = [2, 4, 8]

// Seletor que devolve `[]` novo a cada leitura faz o zustand v5 entrar em loop
// de render (React #185); sem dados, devolva sempre estas mesmas referências.
const NO_STROKES: DrawStroke[] = []
const NO_STROKE_IDS: string[] = []

export const selectStrokes =
  (sharerId: string) =>
  (s: Pick<AnnotationState, 'strokes'>): DrawStroke[] =>
    s.strokes[sharerId] ?? NO_STROKES

export const selectMyStrokeIds =
  (sharerId: string) =>
  (s: Pick<AnnotationState, 'myStrokeIds'>): string[] =>
    s.myStrokeIds[sharerId] ?? NO_STROKE_IDS

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  tool: 'pen',
  color: '#ef4444',
  width: 4,
  drawingActive: {},
  strokes: {},
  myStrokeIds: {},

  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setWidth: (width) => set({ width }),

  toggleDrawing: (sharerId) =>
    set((s) => ({
      drawingActive: {
        ...s.drawingActive,
        [sharerId]: !s.drawingActive[sharerId]
      }
    })),

  setDrawingActive: (sharerId, active) =>
    set((s) => ({
      drawingActive: {
        ...s.drawingActive,
        [sharerId]: active
      }
    })),

  addStroke: (callId, sharerId, partial) => {
    const meId = useAuthStore.getState().user?.id ?? 'me'
    const fullStroke: DrawStroke = {
      ...partial,
      sharer_id: sharerId,
      user_id: meId,
      created_at: Date.now()
    }

    set((s) => {
      const list = s.strokes[sharerId] ?? []
      const myList = s.myStrokeIds[sharerId] ?? []
      return {
        strokes: {
          ...s.strokes,
          [sharerId]: [...list, fullStroke]
        },
        myStrokeIds: {
          ...s.myStrokeIds,
          [sharerId]: [...myList, fullStroke.id]
        }
      }
    })

    if (callId) {
      useChatStore.getState().sendEvent('call:screen_draw', {
        call_id: callId,
        sharer_id: sharerId,
        stroke: fullStroke
      })
    }
  },

  undo: (callId, sharerId) => {
    const s = get()
    const myList = s.myStrokeIds[sharerId] ?? []
    if (myList.length === 0) return

    const lastId = myList[myList.length - 1]
    set((state) => {
      const list = state.strokes[sharerId] ?? []
      return {
        strokes: {
          ...state.strokes,
          [sharerId]: list.filter((st) => st.id !== lastId)
        },
        myStrokeIds: {
          ...state.myStrokeIds,
          [sharerId]: (state.myStrokeIds[sharerId] ?? []).filter((id) => id !== lastId)
        }
      }
    })

    if (callId) {
      useChatStore.getState().sendEvent('call:screen_draw_undo', {
        call_id: callId,
        sharer_id: sharerId,
        stroke_id: lastId
      })
    }
  },

  clear: (callId, sharerId) => {
    set((s) => ({
      strokes: {
        ...s.strokes,
        [sharerId]: []
      },
      myStrokeIds: {
        ...s.myStrokeIds,
        [sharerId]: []
      }
    }))

    if (callId) {
      useChatStore.getState().sendEvent('call:screen_draw_clear', {
        call_id: callId,
        sharer_id: sharerId
      })
    }
  },

  removeStrokeLocally: (sharerId, strokeId) => {
    set((s) => ({
      strokes: {
        ...s.strokes,
        [sharerId]: (s.strokes[sharerId] ?? []).filter((st) => st.id !== strokeId)
      },
      myStrokeIds: {
        ...s.myStrokeIds,
        [sharerId]: (s.myStrokeIds[sharerId] ?? []).filter((id) => id !== strokeId)
      }
    }))
  },

  handleWsEvent: (event) => {
    const meId = useAuthStore.getState().user?.id
    switch (event.type) {
      case 'call:screen_draw': {
        const payload = event.payload as {
          call_id: string
          sharer_id: string
          stroke: DrawStroke
        }
        if (!payload?.sharer_id || !payload?.stroke) return
        // Se foi enviado por mim, já inseri localmente otimista
        if (payload.stroke.user_id === meId) return

        set((s) => {
          const list = s.strokes[payload.sharer_id] ?? []
          if (list.some((st) => st.id === payload.stroke.id)) return s
          return {
            strokes: {
              ...s.strokes,
              [payload.sharer_id]: [...list, payload.stroke]
            }
          }
        })
        return
      }

      case 'call:screen_draw_clear': {
        const payload = event.payload as {
          call_id: string
          sharer_id: string
        }
        if (!payload?.sharer_id) return
        set((s) => ({
          strokes: {
            ...s.strokes,
            [payload.sharer_id]: []
          },
          myStrokeIds: {
            ...s.myStrokeIds,
            [payload.sharer_id]: []
          }
        }))
        return
      }

      case 'call:screen_draw_undo': {
        const payload = event.payload as {
          call_id: string
          sharer_id: string
          stroke_id: string
        }
        if (!payload?.sharer_id || !payload?.stroke_id) return
        set((s) => ({
          strokes: {
            ...s.strokes,
            [payload.sharer_id]: (s.strokes[payload.sharer_id] ?? []).filter(
              (st) => st.id !== payload.stroke_id
            )
          },
          myStrokeIds: {
            ...s.myStrokeIds,
            [payload.sharer_id]: (s.myStrokeIds[payload.sharer_id] ?? []).filter(
              (id) => id !== payload.stroke_id
            )
          }
        }))
        return
      }
    }
  },

  cleanup: (sharerId) => {
    if (sharerId) {
      set((s) => {
        const nextStrokes = { ...s.strokes }
        const nextMy = { ...s.myStrokeIds }
        const nextActive = { ...s.drawingActive }
        delete nextStrokes[sharerId]
        delete nextMy[sharerId]
        delete nextActive[sharerId]
        return {
          strokes: nextStrokes,
          myStrokeIds: nextMy,
          drawingActive: nextActive
        }
      })
    } else {
      set({
        strokes: {},
        myStrokeIds: {},
        drawingActive: {}
      })
    }
  }
}))
