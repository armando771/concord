import { rng, type Scene } from '../../levels/lib/sceneKit'
import type { ServerScene } from './serverLevelScene'
import {
  coreLayer,
  fireworksLayer,
  lightningLayer,
  type LayerBuilder,
  type ServerEnv
} from './serverSceneCore'
import { auroraLayer, galaxyLayer } from './serverSceneCosmos'
import { MILESTONE_LAYERS } from './serverSceneMilestones'

/** Onde fica o ícone do servidor numa tela `w`×`h` (do celular ao monitor largo). */
export function serverSceneLayout(w: number, h: number): { cx: number; cy: number; icon: number } {
  return {
    cx: w / 2,
    cy: h * 0.42,
    icon: Math.round(Math.max(36, Math.min(w * 0.11, h * 0.11, 72)))
  }
}

interface Part {
  build: LayerBuilder
  /** Fatia do orçamento de partículas. */
  weight: number
}

/** As camadas ligadas pela faixa e pelo marco, com o peso de cada uma no orçamento. */
function partsFor(scene: ServerScene): Part[] {
  const parts: Part[] = [{ build: coreLayer, weight: 3 }]
  if (scene.layers.fireworks) parts.push({ build: fireworksLayer, weight: 2 })
  if (scene.layers.lightning) parts.push({ build: lightningLayer, weight: 0.3 })
  if (scene.layers.galaxy) parts.push({ build: galaxyLayer, weight: 2 })
  if (scene.layers.aurora) parts.push({ build: auroraLayer, weight: 0.7 })
  if (scene.milestone) parts.push({ build: MILESTONE_LAYERS[scene.milestone], weight: 2 })
  return parts
}

/**
 * Monta a cena inteira (camadas da faixa + a do marco) e divide as
 * partículas entre elas; a soma nunca passa de `scene.particles`.
 */
export function buildServerScene(scene: ServerScene, w: number, h: number): Scene {
  const env: ServerEnv = {
    w,
    h,
    ...serverSceneLayout(w, h),
    palette: scene.palette,
    color: scene.color,
    durationMs: scene.durationMs,
    rings: scene.rings
  }
  const parts = partsFor(scene)
  const total = parts.reduce((sum, p) => sum + p.weight, 0)
  const r = rng(scene.level * 104729 + 7)
  const layers = parts.map((p) => p.build(env, r, Math.floor((scene.particles * p.weight) / total)))
  return {
    particles: layers.reduce((sum, l) => sum + l.particles, 0),
    draw: (ctx, t) => {
      for (const layer of layers) layer.draw(ctx, t)
    }
  }
}
