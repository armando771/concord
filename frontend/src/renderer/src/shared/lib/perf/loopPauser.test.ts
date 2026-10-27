import { describe, expect, it, vi } from 'vitest'
import { holdLoops, isEndlessLoop, LoopPauser, type PausableAnimation } from './loopPauser'

function anim(iterations: number, playState = 'running'): PausableAnimation & { playState: string } {
  const a = {
    playState,
    effect: { getTiming: () => ({ iterations }) },
    pause: vi.fn(() => {
      a.playState = 'paused'
    }),
    play: vi.fn(() => {
      a.playState = 'running'
    })
  }
  return a
}

describe('isEndlessLoop', () => {
  it('só as animações infinitas (pulse, glow, ping...) contam', () => {
    expect(isEndlessLoop(anim(Infinity))).toBe(true)
    expect(isEndlessLoop(anim(1))).toBe(false)
    expect(isEndlessLoop({ ...anim(1), effect: null })).toBe(false)
  })
})

describe('LoopPauser', () => {
  it('pausa só as infinitas que estão rodando (entrada de modal/toast continua)', () => {
    const loop = anim(Infinity)
    const entrance = anim(1)
    const pauser = new LoopPauser()
    pauser.pause([loop, entrance])
    expect(loop.pause).toHaveBeenCalledOnce()
    expect(entrance.pause).not.toHaveBeenCalled()
  })

  it('não mexe numa infinita que outra parte do app já pausou', () => {
    const paused = anim(Infinity, 'paused')
    const pauser = new LoopPauser()
    pauser.pause([paused])
    pauser.resume()
    expect(paused.play).not.toHaveBeenCalled()
  })

  it('volta a tocar as que pausou', () => {
    const loop = anim(Infinity)
    const pauser = new LoopPauser()
    pauser.pause([loop])
    pauser.resume()
    expect(loop.play).toHaveBeenCalledOnce()
    expect(loop.playState).toBe('running')
  })

  it('não ressuscita animação cancelada enquanto pausada (elemento saiu da tela)', () => {
    const loop = anim(Infinity)
    const pauser = new LoopPauser()
    pauser.pause([loop])
    loop.playState = 'idle'
    pauser.resume()
    expect(loop.play).not.toHaveBeenCalled()
  })

  it('pausar de novo (nova varredura) não duplica e o resume esvazia a lista', () => {
    const loop = anim(Infinity)
    const pauser = new LoopPauser()
    pauser.pause([loop])
    pauser.pause([loop])
    pauser.resume()
    pauser.resume()
    expect(loop.pause).toHaveBeenCalledOnce()
    expect(loop.play).toHaveBeenCalledOnce()
  })
})

describe('holdLoops', () => {
  it('pausa já, pega as que surgem na varredura seguinte e solta tudo no fim', () => {
    vi.useFakeTimers()
    const first = anim(Infinity)
    const later = anim(Infinity)
    const list: PausableAnimation[] = [first]
    const release = holdLoops(() => list, 1000)
    expect(first.playState).toBe('paused')
    list.push(later)
    vi.advanceTimersByTime(1000)
    expect(later.playState).toBe('paused')
    release()
    expect(first.playState).toBe('running')
    expect(later.playState).toBe('running')
    const after = anim(Infinity)
    list.push(after)
    vi.advanceTimersByTime(5000)
    expect(after.playState).toBe('running')
    vi.useRealTimers()
  })
})
