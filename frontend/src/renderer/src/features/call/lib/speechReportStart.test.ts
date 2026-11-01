import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ sendEvent: vi.fn() }))
// O callStore de verdade puxa LiveKit e áudio: aqui um store zustand com os mesmos campos.
vi.mock('../store/callStore', async () => {
  const { create } = await import('zustand')
  return { useCallStore: create(() => ({})) }
})
vi.mock('../../auth/store/authStore', async () => {
  const { create } = await import('zustand')
  return { useAuthStore: create(() => ({ user: { id: 'eu' } })) }
})
vi.mock('../../chat/store/chatStore', async () => {
  const { create } = await import('zustand')
  return { useChatStore: create(() => ({ sendEvent: h.sendEvent })) }
})

import { useCallStore } from '../store/callStore'
import { startSpeechReport } from './speechReportStart'
import { SPEECH_REPORT_EVERY_MS } from './speechReport'

describe('startSpeechReport (store zustand + timer)', () => {
  let stop: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    h.sendEvent.mockClear()
    useCallStore.setState({ callId: 'c1', status: 'active', muted: false, speakingIds: [] })
    stop = startSpeechReport()
  })

  afterEach(() => {
    stop()
    vi.useRealTimers()
  })

  it('avisa ao começar a falar e de novo a cada 15 s falando', () => {
    useCallStore.setState({ speakingIds: ['eu'] })
    expect(h.sendEvent).toHaveBeenCalledWith('call:speaking', { call_id: 'c1' })

    vi.advanceTimersByTime(SPEECH_REPORT_EVERY_MS)
    expect(h.sendEvent).toHaveBeenCalledTimes(2)
  })

  it('outros falando ou eu calado: nada vai para o servidor', () => {
    useCallStore.setState({ speakingIds: ['ana'] })
    vi.advanceTimersByTime(SPEECH_REPORT_EVERY_MS * 2)
    expect(h.sendEvent).not.toHaveBeenCalled()
  })

  it('depois de desligar não avisa mais', () => {
    stop()
    useCallStore.setState({ speakingIds: ['eu'] })
    vi.advanceTimersByTime(SPEECH_REPORT_EVERY_MS)
    expect(h.sendEvent).not.toHaveBeenCalled()
    stop = () => {}
  })
})
