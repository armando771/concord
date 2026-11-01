import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSubmenuController, type SubmenuDeps } from './submenuController'
import type { SubmenuPlacement } from './submenuPlacement'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const box = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom
})

interface FakeItem {
  focus: ReturnType<typeof vi.fn>
}

function setup(opts: { viewportWidth?: number; items?: number } = {}) {
  const parentBox = box(100, 150, 332, 420)
  const parent = { getBoundingClientRect: () => parentBox }
  const trigger = {
    getBoundingClientRect: () => box(108, 200, 324, 232),
    closest: vi.fn(() => parent),
    contains: vi.fn((n: unknown) => n === 'in-trigger'),
    focus: vi.fn()
  }
  const items: FakeItem[] = Array.from({ length: opts.items ?? 3 }, () => ({ focus: vi.fn() }))
  const panel = {
    getBoundingClientRect: () => box(330, 191, 554, 391),
    contains: vi.fn((n: unknown) => n === 'in-panel'),
    querySelectorAll: vi.fn(() => items)
  }
  let active: unknown = null
  const listeners: Record<string, (e: { target: unknown }) => void> = {}
  const off = vi.fn()
  const deps: SubmenuDeps = {
    setOpen: vi.fn(),
    setPlacement: vi.fn(),
    viewport: () => ({ width: opts.viewportWidth ?? 1280, height: 720 }),
    activeElement: () => active,
    listen: (target, type, fn) => {
      listeners[`${target}:${type}`] = fn as never
      return off
    }
  }
  const ctl = createSubmenuController(deps)
  ctl.setTrigger(trigger as never)
  ctl.setPanel(panel as never)
  return {
    ctl,
    deps,
    trigger,
    panel,
    items,
    listeners,
    off,
    setActive: (v: unknown) => (active = v)
  }
}

const lastOpen = (deps: SubmenuDeps) =>
  (deps.setOpen as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]

describe('submenuController: mouse', () => {
  it('abre depois do atraso ao entrar com o mouse', () => {
    const { ctl, deps } = setup()
    ctl.hoverEnter('mouse')
    expect(deps.setOpen).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(lastOpen(deps)).toBe(true)
  })

  it('não abre por hover no toque nem quando só cabe cobrindo o menu', () => {
    const touch = setup()
    touch.ctl.hoverEnter('touch')
    vi.advanceTimersByTime(500)
    expect(touch.deps.setOpen).not.toHaveBeenCalled()

    const narrow = setup({ viewportWidth: 360 })
    narrow.ctl.hoverEnter('mouse')
    vi.advanceTimersByTime(500)
    expect(narrow.deps.setOpen).not.toHaveBeenCalled()
  })

  it('fecha logo ao sair do item para outro lado', () => {
    const { ctl, deps } = setup()
    ctl.open(false)
    ctl.hoverLeave('mouse', { x: 200, y: 400 })
    vi.advanceTimersByTime(200)
    expect(lastOpen(deps)).toBe(false)
  })

  it('espera mais quando o mouse vai na diagonal para o painel', () => {
    const { ctl, deps } = setup()
    ctl.open(false)
    ctl.layout()
    ctl.pointerMove({ x: 250, y: 215 })
    ctl.hoverLeave('mouse', { x: 300, y: 240 })
    vi.advanceTimersByTime(200)
    expect(lastOpen(deps)).toBe(true)
    vi.advanceTimersByTime(400)
    expect(lastOpen(deps)).toBe(false)
  })

  it('chegar no painel cancela o fechamento; sair do painel fecha', () => {
    const { ctl, deps } = setup()
    ctl.open(false)
    ctl.layout()
    ctl.hoverLeave('mouse', { x: 340, y: 215 })
    ctl.panelEnter()
    vi.advanceTimersByTime(1000)
    expect(lastOpen(deps)).toBe(true)
    ctl.panelLeave('mouse')
    vi.advanceTimersByTime(200)
    expect(lastOpen(deps)).toBe(false)
  })

  it('cobrindo o menu (celular) o mouse sair não fecha', () => {
    const { ctl, deps } = setup({ viewportWidth: 360 })
    ctl.open(false)
    ctl.layout()
    ctl.hoverLeave('mouse', { x: 200, y: 400 })
    ctl.panelLeave('mouse')
    vi.advanceTimersByTime(1000)
    expect(lastOpen(deps)).toBe(true)
  })

  it('ignora saída de ponteiro de toque (o toque dispara leave logo após o toque)', () => {
    const { ctl, deps } = setup()
    ctl.open(false)
    ctl.layout()
    ctl.hoverLeave('touch', { x: 200, y: 400 })
    ctl.panelLeave('touch')
    vi.advanceTimersByTime(1000)
    expect(lastOpen(deps)).toBe(true)
  })
})

describe('submenuController: posição e foco', () => {
  it('layout mede o item e o painel e publica a posição', () => {
    const { ctl, deps } = setup()
    ctl.open(false)
    ctl.layout()
    const placement = (deps.setPlacement as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as SubmenuPlacement
    expect(placement).toMatchObject({ side: 'right', left: 330, top: 191 })
  })

  it('layout não faz nada sem os elementos montados', () => {
    const { ctl, deps } = setup()
    ctl.setPanel(null)
    ctl.layout()
    expect(deps.setPlacement).not.toHaveBeenCalled()
  })

  it('aberto pelo teclado, foca o primeiro item depois da posição', () => {
    const { ctl, items } = setup()
    ctl.open(true)
    expect(items[0].focus).not.toHaveBeenCalled()
    ctl.layout()
    expect(items[0].focus).toHaveBeenCalledTimes(1)
    ctl.layout()
    expect(items[0].focus).toHaveBeenCalledTimes(1)
  })

  it('aberto pelo mouse não rouba o foco', () => {
    const { ctl, items } = setup()
    ctl.open(false)
    ctl.layout()
    expect(items[0].focus).not.toHaveBeenCalled()
  })

  it('seta para a direita com o submenu já aberto foca o primeiro item', () => {
    const { ctl, items } = setup()
    ctl.open(false)
    ctl.layout()
    ctl.open(true)
    expect(items[0].focus).toHaveBeenCalledTimes(1)
  })
})

describe('submenuController: teclado', () => {
  it('seta para a direita no item pai abre e consome a tecla', () => {
    const { ctl, deps } = setup()
    expect(ctl.keyDownTrigger('ArrowRight')).toBe(true)
    expect(lastOpen(deps)).toBe(true)
    expect(ctl.keyDownTrigger('ArrowDown')).toBe(false)
  })

  it('setas movem o foco entre os itens, dando a volta', () => {
    const { ctl, items, setActive } = setup()
    setActive(items[2])
    expect(ctl.keyDownPanel('ArrowDown')).toBe(true)
    expect(items[0].focus).toHaveBeenCalled()
    setActive(items[0])
    ctl.keyDownPanel('ArrowUp')
    expect(items[2].focus).toHaveBeenCalled()
  })

  it('Esc fecha e devolve o foco ao item pai', () => {
    const { ctl, deps, trigger } = setup()
    ctl.open(false)
    expect(ctl.keyDownPanel('Escape')).toBe(true)
    expect(lastOpen(deps)).toBe(false)
    expect(trigger.focus).toHaveBeenCalled()
  })

  it('seta para a esquerda também fecha; outras teclas passam', () => {
    const { ctl, deps } = setup()
    ctl.open(false)
    expect(ctl.keyDownPanel('ArrowLeft')).toBe(true)
    expect(lastOpen(deps)).toBe(false)
    expect(ctl.keyDownPanel('a')).toBe(false)
  })
})

describe('submenuController: fechar', () => {
  it('clique fora fecha; dentro do item ou do painel não', () => {
    const { ctl, deps } = setup()
    ctl.open(false)
    ctl.outsideDown('in-trigger')
    ctl.outsideDown('in-panel')
    expect(lastOpen(deps)).toBe(true)
    ctl.outsideDown('elsewhere')
    expect(lastOpen(deps)).toBe(false)
  })

  it('clique fora com o submenu fechado não faz nada', () => {
    const { ctl, deps } = setup()
    ctl.outsideDown('elsewhere')
    expect(deps.setOpen).not.toHaveBeenCalled()
  })

  it('attach escuta clique, resize e scroll, e solta tudo no cleanup', () => {
    const { ctl, listeners, off, panel, deps } = setup()
    ctl.open(false)
    const detach = ctl.attach()
    expect(Object.keys(listeners).sort()).toEqual([
      'document:pointerdown',
      'window:resize',
      'window:scroll'
    ])
    listeners['window:scroll']({ target: 'in-panel' })
    expect(lastOpen(deps)).toBe(true)
    listeners['window:scroll']({ target: 'menu-pai' })
    expect(lastOpen(deps)).toBe(false)
    listeners['document:pointerdown']({ target: 'elsewhere' })
    listeners['window:resize']({ target: null })
    expect(deps.setPlacement).toHaveBeenCalled()
    detach()
    expect(off).toHaveBeenCalledTimes(3)
    expect(panel.contains).toHaveBeenCalled()
  })

  it('dispose cancela o que estava agendado', () => {
    const { ctl, deps } = setup()
    ctl.hoverEnter('mouse')
    ctl.dispose()
    vi.advanceTimersByTime(1000)
    expect(deps.setOpen).not.toHaveBeenCalled()
  })
})
