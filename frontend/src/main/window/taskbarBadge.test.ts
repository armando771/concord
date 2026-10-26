import { describe, expect, it } from 'vitest'
import { badgeBitmap, badgeDescription, badgeLabel, taskbarAction } from './taskbarBadge'

const pixel = (buf: Buffer, size: number, x: number, y: number): number[] => {
  const i = (y * size + x) * 4
  return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
}

describe('taskbarAction', () => {
  it('com a opção ligada (padrão), pisca e mostra o selo', () => {
    expect(taskbarAction({})).toEqual({ flash: true, badge: true })
    expect(taskbarAction({ taskbar: true })).toEqual({ flash: true, badge: true })
  })

  it('com a opção desligada, não mexe na barra de tarefas', () => {
    expect(taskbarAction({ taskbar: false })).toEqual({ flash: false, badge: false })
  })

  it('chamada recebida sempre pisca, mesmo com a opção desligada', () => {
    expect(taskbarAction({ urgent: true, taskbar: false })).toEqual({ flash: true, badge: false })
    expect(taskbarAction({ urgent: true })).toEqual({ flash: true, badge: false })
  })
})

describe('badgeLabel', () => {
  it('sem pendências não há selo', () => {
    expect(badgeLabel(0)).toBeNull()
  })

  it('mostra o número até 9 e depois "9+"', () => {
    expect(badgeLabel(1)).toBe('1')
    expect(badgeLabel(9)).toBe('9')
    expect(badgeLabel(10)).toBe('9+')
    expect(badgeLabel(250)).toBe('9+')
  })
})

describe('badgeDescription', () => {
  it('singular e plural', () => {
    expect(badgeDescription(1)).toBe('1 notificação não lida')
    expect(badgeDescription(3)).toBe('3 notificações não lidas')
  })
})

describe('badgeBitmap', () => {
  it('gera BGRA do tamanho pedido', () => {
    expect(badgeBitmap('1', 32).length).toBe(32 * 32 * 4)
    expect(badgeBitmap('1', 16).length).toBe(16 * 16 * 4)
  })

  it('é um círculo vermelho: cantos transparentes, borda vermelha opaca', () => {
    const buf = badgeBitmap('', 32)
    expect(pixel(buf, 32, 0, 0)[3]).toBe(0)
    expect(pixel(buf, 32, 31, 31)[3]).toBe(0)
    expect(pixel(buf, 32, 16, 2)).toEqual([0x45, 0x42, 0xf2, 255])
  })

  it('desenha o número em branco no meio', () => {
    const buf = badgeBitmap('8', 32)
    const white = [255, 255, 255, 255]
    let whites = 0
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++)
        if (pixel(buf, 32, x, y).every((v, i) => v === white[i])) whites++
    // '8' tem 13 células acesas, cada uma 2x2 em 32px
    expect(whites).toBe(13 * 4)
    expect(pixel(buf, 32, 15, 13)).not.toEqual(white) // miolo do 8 é vazado
  })

  it('"9+" cabe dentro do círculo', () => {
    const buf = badgeBitmap('9+', 32)
    let whites = 0
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const [b, g, r] = pixel(buf, 32, x, y)
        if (b !== 255 || g !== 255 || r !== 255) continue
        whites++
        expect(Math.hypot(x + 0.5 - 16, y + 0.5 - 16)).toBeLessThan(14)
      }
    expect(whites).toBeGreaterThan(0)
  })
})
