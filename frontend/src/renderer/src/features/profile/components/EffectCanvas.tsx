import { useEffect, useRef } from 'react'
import { browserEnv } from '../lib/effects/browserEnv'
import { canvasScene, seededRand } from '../lib/effects'
import { mountEffect } from '../lib/effects/mount'
import type { EffectParams, Scene } from '../lib/effects/types'
import '../../../assets/profileTheme.css'

/** Liga a cena ao canvas enquanto o efeito e os parâmetros não mudam. */
function useEffectScene(
  ref: React.RefObject<HTMLCanvasElement | null>,
  scene: Scene | null,
  { density, speed, color }: EffectParams
): void {
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !scene) return
    return mountEffect(canvas, {
      scene,
      params: { density, speed, color },
      env: browserEnv(),
      rand: seededRand(Math.floor(Math.random() * 2 ** 32))
    })
  }, [ref, scene, density, speed, color])
}

/**
 * Efeito animado do cartão de perfil desenhado num <canvas> por cima do
 * cartão (sem clique, decorativo). A lógica fica em lib/effects; aqui só
 * liga a cena ao elemento. Efeito que não é de canvas → nada.
 */
export default function EffectCanvas({
  effect,
  params
}: {
  effect: string
  params: EffectParams
}): React.JSX.Element | null {
  const ref = useRef<HTMLCanvasElement>(null)
  const scene = canvasScene(effect)
  useEffectScene(ref, scene, params)
  if (!scene) return null
  return <canvas ref={ref} aria-hidden="true" className="pt-fx" />
}
