import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnnotationStore } from './annotationStore'
import { useChatStore } from './chatStore'

vi.mock('./chatStore', () => ({
  useChatStore: {
    getState: vi.fn(() => ({
      sendEvent: vi.fn()
    }))
  }
}))

vi.mock('./authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      user: { id: 'user-me' }
    }))
  }
}))

describe('annotationStore', () => {
  const chat = { sendEvent: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useChatStore.getState).mockReturnValue(chat as never)
    useAnnotationStore.getState().cleanup()
  })

  it('estado inicial e setters de ferramentas e cores', () => {
    const s = useAnnotationStore.getState()
    expect(s.tool).toBe('pen')
    expect(s.color).toBe('#ef4444')
    expect(s.width).toBe(4)

    s.setTool('laser')
    s.setColor('#22c55e')
    s.setWidth(8)

    const updated = useAnnotationStore.getState()
    expect(updated.tool).toBe('laser')
    expect(updated.color).toBe('#22c55e')
    expect(updated.width).toBe(8)
  })

  it('toggleDrawing ativa e desativa o modo desenho por transmissor', () => {
    const s = useAnnotationStore.getState()
    expect(s.drawingActive['sharer-1']).toBeFalsy()

    s.toggleDrawing('sharer-1')
    expect(useAnnotationStore.getState().drawingActive['sharer-1']).toBe(true)

    s.toggleDrawing('sharer-1')
    expect(useAnnotationStore.getState().drawingActive['sharer-1']).toBe(false)
  })

  it('addStroke grava traço localmente e emite call:screen_draw', () => {
    useAnnotationStore.getState().addStroke('call-1', 'sharer-1', {
      id: 'st-1',
      tool: 'pen',
      color: '#ef4444',
      width: 4,
      points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }]
    })

    const list = useAnnotationStore.getState().strokes['sharer-1']
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('st-1')
    expect(list[0].user_id).toBe('user-me')

    expect(chat.sendEvent).toHaveBeenCalledWith('call:screen_draw', {
      call_id: 'call-1',
      sharer_id: 'sharer-1',
      stroke: expect.objectContaining({ id: 'st-1', user_id: 'user-me' })
    })
  })

  it('undo remove o último traço desenhado pelo usuário local e emite call:screen_draw_undo', () => {
    const store = useAnnotationStore.getState()
    store.addStroke('call-1', 'sharer-1', {
      id: 'st-1',
      tool: 'pen',
      color: '#ef4444',
      width: 4,
      points: [{ x: 0.1, y: 0.1 }]
    })
    store.addStroke('call-1', 'sharer-1', {
      id: 'st-2',
      tool: 'pen',
      color: '#ef4444',
      width: 4,
      points: [{ x: 0.2, y: 0.2 }]
    })

    expect(useAnnotationStore.getState().strokes['sharer-1']).toHaveLength(2)

    chat.sendEvent.mockClear()
    useAnnotationStore.getState().undo('call-1', 'sharer-1')

    const remaining = useAnnotationStore.getState().strokes['sharer-1']
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('st-1')

    expect(chat.sendEvent).toHaveBeenCalledWith('call:screen_draw_undo', {
      call_id: 'call-1',
      sharer_id: 'sharer-1',
      stroke_id: 'st-2'
    })
  })

  it('clear limpa todos os traços e emite call:screen_draw_clear', () => {
    useAnnotationStore.getState().addStroke('call-1', 'sharer-1', {
      id: 'st-1',
      tool: 'pen',
      color: '#ef4444',
      width: 4,
      points: [{ x: 0.1, y: 0.1 }]
    })

    chat.sendEvent.mockClear()
    useAnnotationStore.getState().clear('call-1', 'sharer-1')

    expect(useAnnotationStore.getState().strokes['sharer-1']).toEqual([])
    expect(chat.sendEvent).toHaveBeenCalledWith('call:screen_draw_clear', {
      call_id: 'call-1',
      sharer_id: 'sharer-1'
    })
  })

  it('handleWsEvent trata traços de outros usuários', () => {
    useAnnotationStore.getState().handleWsEvent({
      type: 'call:screen_draw',
      payload: {
        call_id: 'call-1',
        sharer_id: 'sharer-1',
        stroke: {
          id: 'st-remote',
          sharer_id: 'sharer-1',
          user_id: 'user-remote',
          tool: 'highlighter',
          color: '#38bdf8',
          width: 8,
          points: [{ x: 0.5, y: 0.5 }],
          created_at: Date.now()
        }
      }
    })

    const list = useAnnotationStore.getState().strokes['sharer-1']
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('st-remote')

    // Undo via WS
    useAnnotationStore.getState().handleWsEvent({
      type: 'call:screen_draw_undo',
      payload: {
        call_id: 'call-1',
        sharer_id: 'sharer-1',
        stroke_id: 'st-remote'
      }
    })

    expect(useAnnotationStore.getState().strokes['sharer-1']).toHaveLength(0)
  })
})
