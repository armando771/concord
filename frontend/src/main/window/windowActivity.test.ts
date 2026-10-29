import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { allowBackgroundThrottling, readActivity, watchWindowActivity } from './windowActivity'

function fakeWindow(state = { focused: true, visible: true, minimized: false }) {
  const win = new EventEmitter() as EventEmitter & Record<string, unknown>
  const contents = new EventEmitter() as EventEmitter & Record<string, unknown>
  contents.send = vi.fn()
  contents.setBackgroundThrottling = vi.fn()
  Object.assign(win, {
    state,
    webContents: contents,
    isDestroyed: () => false,
    isFocused: () => state.focused,
    isVisible: () => state.visible,
    isMinimized: () => state.minimized
  })
  return { win, contents, state }
}

describe('readActivity', () => {
  it('minimizada não está visível nem em foco (o Windows mantém o foco na minimizada às vezes)', () => {
    const { win } = fakeWindow({ focused: true, visible: true, minimized: true })
    expect(readActivity(win as never)).toEqual({ focused: false, visible: false })
  })

  it('escondida na bandeja não está visível', () => {
    const { win } = fakeWindow({ focused: false, visible: false, minimized: false })
    expect(readActivity(win as never)).toEqual({ focused: false, visible: false })
  })

  it('atrás do jogo: visível e sem foco', () => {
    const { win } = fakeWindow({ focused: false, visible: true, minimized: false })
    expect(readActivity(win as never)).toEqual({ focused: false, visible: true })
  })
})

describe('allowBackgroundThrottling', () => {
  it('sem chamada o Chromium pode segurar timers e quadros em segundo plano', () => {
    expect(allowBackgroundThrottling(false)).toBe(true)
  })

  it('em chamada não: a captura e o áudio não podem travar', () => {
    expect(allowBackgroundThrottling(true)).toBe(false)
  })
})

describe('watchWindowActivity', () => {
  const setup = (inCall = false) => {
    const fake = fakeWindow()
    const listeners: Array<(s: { inCall: boolean }) => void> = []
    watchWindowActivity(fake.win as never, {
      inCall: () => inCall,
      onCallStateChange: (l) => listeners.push(l)
    })
    return { ...fake, callChanged: (v: boolean) => listeners.forEach((l) => l({ inCall: v })) }
  }

  it('avisa o renderer quando perde o foco e quando volta', () => {
    const { win, contents, state } = setup()
    state.focused = false
    win.emit('blur')
    state.focused = true
    win.emit('focus')
    expect(contents.send).toHaveBeenNthCalledWith(1, 'window:activity', { focused: false, visible: true })
    expect(contents.send).toHaveBeenNthCalledWith(2, 'window:activity', { focused: true, visible: true })
  })

  it('não repete o mesmo estado (blur seguido de minimize na mesma situação)', () => {
    const { win, contents, state } = setup()
    state.minimized = true
    win.emit('minimize')
    win.emit('blur')
    expect(contents.send).toHaveBeenCalledTimes(1)
  })

  it('página recarregada recebe o estado atual de novo', () => {
    const { win, contents, state } = setup()
    state.focused = false
    win.emit('blur')
    contents.emit('did-finish-load')
    expect(contents.send).toHaveBeenCalledTimes(2)
  })

  it('throttling liga sem chamada e desliga ao entrar numa', () => {
    const { contents, callChanged } = setup(false)
    expect(contents.setBackgroundThrottling).toHaveBeenLastCalledWith(true)
    callChanged(true)
    expect(contents.setBackgroundThrottling).toHaveBeenLastCalledWith(false)
  })

  it('já em chamada ao criar a janela: começa sem throttling', () => {
    const { contents } = setup(true)
    expect(contents.setBackgroundThrottling).toHaveBeenLastCalledWith(false)
  })

  it('janela destruída não recebe mais nada', () => {
    const { win, contents, callChanged } = setup()
    ;(win as unknown as { isDestroyed: () => boolean }).isDestroyed = () => true
    callChanged(true)
    win.emit('blur')
    expect(contents.setBackgroundThrottling).toHaveBeenCalledTimes(1)
    expect(contents.send).not.toHaveBeenCalled()
  })
})
