import { describe, expect, it } from 'vitest'
import { createTTSQueue, type TTSSpeaker } from './ttsQueue'

function fakeSpeaker(): TTSSpeaker & { spoken: string[]; finish: () => void; cancels: number } {
  let done: (() => void) | null = null
  const s = {
    spoken: [] as string[],
    cancels: 0,
    speak(text: string, onEnd: () => void) {
      s.spoken.push(text)
      done = onEnd
    },
    cancel() {
      s.cancels++
      done = null
    },
    finish() {
      const d = done
      done = null
      d?.()
    }
  }
  return s
}

describe('createTTSQueue', () => {
  it('fala uma por vez, na ordem', () => {
    const sp = fakeSpeaker()
    const q = createTTSQueue(sp)
    q.enqueue('a')
    q.enqueue('b')
    expect(sp.spoken).toEqual(['a'])
    sp.finish()
    expect(sp.spoken).toEqual(['a', 'b'])
    sp.finish()
    q.enqueue('c')
    expect(sp.spoken).toEqual(['a', 'b', 'c'])
  })
  it('numa rajada guarda no máximo 5 esperando (as mais antigas caem)', () => {
    const sp = fakeSpeaker()
    const q = createTTSQueue(sp, 5)
    for (const t of ['0', '1', '2', '3', '4', '5', '6']) q.enqueue(t)
    for (let i = 0; i < 6; i++) sp.finish()
    expect(sp.spoken).toEqual(['0', '2', '3', '4', '5', '6'])
  })
  it('clear para a fala atual e esvazia a fila', () => {
    const sp = fakeSpeaker()
    const q = createTTSQueue(sp)
    q.enqueue('a')
    q.enqueue('b')
    q.clear()
    expect(sp.cancels).toBe(1)
    sp.finish()
    q.enqueue('c')
    expect(sp.spoken).toEqual(['a', 'c'])
  })
  it('fim atrasado de uma fala cancelada não pula a próxima', () => {
    const sp = fakeSpeaker()
    let late: (() => void) | null = null
    const q = createTTSQueue({
      speak: (text, onEnd) => {
        sp.spoken.push(text)
        if (!late) late = onEnd
      },
      cancel: () => {}
    })
    q.enqueue('a')
    q.clear()
    q.enqueue('b')
    q.enqueue('c')
    late!()
    expect(sp.spoken).toEqual(['a', 'b'])
  })
})
