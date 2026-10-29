import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { serverLevelScene } from './serverLevelScene'
import { buildServerScene, serverSceneLayout } from './serverSceneCanvas'

/** Contexto de canvas que só conta as chamadas (o teste roda sem DOM). */
function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: Record<string, number> } {
  const calls: Record<string, number> = {}
  const gradient = { addColorStop: (): void => {} }
  const target: Record<string, unknown> = {}
  const ctx = new Proxy(target, {
    get: (t, key: string) =>
      key in t
        ? t[key]
        : (): unknown => {
            calls[key] = (calls[key] ?? 0) + 1
            return gradient
          },
    set: (t, key: string, value) => {
      t[key] = value
      return true
    }
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

const LEVELS = [2, 6, 10, 12, 22, 25, 33, 50, 100]

describe('cena de subida do servidor no canvas', () => {
  beforeEach(() => {
    const sprite = { width: 0, height: 0, getContext: () => fakeCtx().ctx }
    vi.stubGlobal('document', { createElement: () => sprite })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('nunca cria mais partículas que a cena pode, e usa quase todas', () => {
    for (const level of LEVELS) {
      const scene = serverLevelScene(level)
      const built = buildServerScene(scene, 1280, 720)
      expect(built.particles, `nível ${level}`).toBeLessThanOrEqual(scene.particles)
      expect(built.particles, `nível ${level}`).toBeGreaterThan(scene.particles * 0.8)
    }
  })

  it('desenha todas as camadas do começo ao fim sem quebrar', () => {
    for (const level of LEVELS) {
      const scene = serverLevelScene(level)
      const { ctx, calls } = fakeCtx()
      const built = buildServerScene(scene, 1280, 720)
      for (let t = 0; t <= scene.durationMs; t += 50) built.draw(ctx, t)
      expect(calls.drawImage, `nível ${level}`).toBeGreaterThan(0)
    }
  })

  it('cada faixa desenha os efeitos dela', () => {
    const count = (level: number): Record<string, number> => {
      const scene = serverLevelScene(level)
      const { ctx, calls } = fakeCtx()
      const built = buildServerScene(scene, 1280, 720)
      for (let t = 0; t <= scene.durationMs; t += 40) built.draw(ctx, t)
      return calls
    }
    expect(count(2).ellipse).toBeUndefined()
    expect(count(12).lineTo).toBeGreaterThan(count(2).lineTo) // raios
    expect(count(33).ellipse).toBeGreaterThan(0) // anéis da faixa lendária
    expect(count(25).fillRect).toBeGreaterThan(count(24).fillRect ?? 0) // clarão da supernova
  })

  it('o ícone cabe na tela do celular ao monitor largo', () => {
    for (const [w, h] of [
      [360, 640],
      [1280, 720],
      [2560, 1440]
    ]) {
      const { cx, cy, icon } = serverSceneLayout(w, h)
      expect(cx).toBe(w / 2)
      expect(icon).toBeGreaterThanOrEqual(36)
      expect(icon).toBeLessThanOrEqual(72)
      expect(cy - icon).toBeGreaterThan(0)
    }
  })
})
