// Catálogo dos efeitos desenhados em <canvas> (id do tema → cena) e o gerador
// de números com semente que o componente e os testes usam.
import { auroraScene } from './aurora'
import { confettiScene } from './confetti'
import { fireScene } from './fire'
import { galaxyScene } from './galaxy'
import { glitchScene } from './glitch'
import { heartsScene } from './hearts'
import { matrixScene } from './matrix'
import { rainScene } from './rain'
import { stormScene } from './storm'
import { synthwaveScene } from './synthwave'
import type { Rand, Scene } from './types'

export const CANVAS_EFFECTS: Record<string, Scene> = {
  fire: fireScene,
  matrix: matrixScene,
  glitch: glitchScene,
  storm: stormScene,
  galaxy: galaxyScene,
  aurora: auroraScene,
  hearts: heartsScene,
  confetti: confettiScene,
  synthwave: synthwaveScene,
  rain: rainScene
}

/** A cena do efeito, ou null se o efeito não é de canvas (ou não existe). */
export function canvasScene(id: string): Scene | null {
  return Object.prototype.hasOwnProperty.call(CANVAS_EFFECTS, id) ? CANVAS_EFFECTS[id] : null
}

/** mulberry32: números em [0, 1), sempre os mesmos para a mesma semente. */
export function seededRand(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
