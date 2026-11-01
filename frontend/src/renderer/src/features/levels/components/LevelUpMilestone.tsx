import { useEffect, useMemo, useRef, useState } from 'react'
import { useCallStore } from '../../call/store/callStore'
import { buildScreenScene, sceneLayout, screenSceneFor, type ScreenScene } from '../lib/screenScene'
import { prefersReducedMotion, runScene } from '../lib/sceneRunner'
import Crown from './Crown'
import { useScreenCelebration } from '../hooks/useScreenCelebration'
import './levelSpecial.css'

/** Número grande (ou "LENDÁRIO") e a faixa embaixo, entrando depois do "momento" da cena. */
function SceneTitle({
  scene,
  fontPx,
  titleAt,
  showNumber
}: {
  scene: ScreenScene
  fontPx: number
  titleAt: number
  showNumber: boolean
}): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center"
      style={{
        animation: `level-ms-title ${scene.durationMs - titleAt}ms cubic-bezier(.3,1.3,.5,1) ${titleAt}ms both`
      }}
    >
      {scene.crown && <Crown size={Math.round(fontPx * 0.45)} />}
      <p
        className={`bg-clip-text font-black leading-none tracking-tight text-transparent ${scene.shine ? 'level-number-shine' : ''}`}
        style={{
          fontSize: scene.crown ? fontPx * 0.42 : fontPx,
          letterSpacing: scene.crown ? '0.18em' : undefined,
          backgroundImage: scene.gradient,
          visibility: showNumber ? undefined : 'hidden',
          filter: `drop-shadow(0 4px 24px ${scene.color}aa)`
        }}
      >
        {scene.numberText}
      </p>
      <p
        className="mt-2 rounded-full border px-4 py-1 text-xs font-extrabold uppercase tracking-[0.3em] text-white shadow-lg"
        style={{
          borderColor: `${scene.color}88`,
          background: `linear-gradient(90deg, ${scene.accent}cc, ${scene.color}aa)`,
          textShadow: '0 1px 2px rgba(0,0,0,.6)'
        }}
      >
        {scene.label}
      </p>
    </div>
  )
}

/**
 * Cena em tela cheia quando VOCÊ chega num marco (10, 20 … 100) ou no nível
 * 24: uma cena diferente por faixa num <canvas> (moedas, onda dourada,
 * vinhas, água, cristais, fogo, prisma, buraco negro, constelação, a
 * sequência lendária e o arco-íris do orgulho do 24) e o número. Fica abaixo
 * dos modais (z-40), nunca recebe clique, para o requestAnimationFrame e sai
 * do DOM quando acaba. Com prefers-reduced-motion só o título aparece e some.
 */
function LevelUpMilestone(): React.JSX.Element | null {
  const celebration = useScreenCelebration()
  const scene = useMemo(
    () => (celebration ? screenSceneFor(celebration.level, celebration.previous) : null),
    [celebration]
  )
  const key = celebration?.key
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [doneKey, setDoneKey] = useState<number | null>(null)
  const reduced = useMemo(() => key !== undefined && prefersReducedMotion(), [key])
  const layout = useMemo(
    () => (key === undefined ? null : sceneLayout(window.innerWidth, window.innerHeight)),
    [key]
  )
  // O que o canvas desenha (nada com movimento reduzido).
  const playing = useMemo(
    () => (scene && layout && !reduced ? { scene, layout } : null),
    [scene, layout, reduced]
  )

  // Some sozinha no fim da cena (a celebração pode durar mais, por causa da faixa).
  useEffect(() => {
    if (key === undefined || !scene) return
    const timer = setTimeout(() => setDoneKey(key), scene.durationMs)
    return () => clearTimeout(timer)
  }, [key, scene])

  useEffect(() => {
    if (!canvasRef.current || !playing) return
    const { scene: s, layout: l } = playing
    return runScene(canvasRef.current, {
      w: l.w,
      h: l.h,
      durationMs: s.durationMs,
      dpr: window.devicePixelRatio,
      // 1× durante a call, que é quando os marcos tocam de verdade.
      inCall: useCallStore.getState().status === 'active',
      build: (ctx) => buildScreenScene(s.kind, { ...l, ...s, level: s.level }, ctx)
    })
  }, [playing])

  if (!celebration || !scene || !layout || doneKey === celebration.key) return null

  const titleAt = reduced ? 0 : scene.titleAt
  const showNumber = reduced || !scene.drawsNumber

  return (
    <div
      key={celebration.key}
      aria-hidden="true"
      data-milestone={scene.kind}
      className={`level-anim pointer-events-none fixed inset-0 z-40 overflow-hidden ${reduced ? 'level-fade' : ''}`}
      style={
        {
          '--level-fade-ms': `${scene.durationMs}ms`,
          '--shake': `${Math.min(6, scene.power * 4 + 1)}px`
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0"
        style={{ animation: `level-shake 600ms linear ${scene.impactMs}ms both` }}
      >
        {!reduced && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}

        <div
          className="absolute left-1/2 flex flex-col items-center"
          style={{ top: layout.cy, transform: 'translate(-50%, -50%)' }}
        >
          <SceneTitle
            scene={scene}
            fontPx={layout.fontPx}
            titleAt={titleAt}
            showNumber={showNumber}
          />
        </div>
      </div>
    </div>
  )
}

export default LevelUpMilestone
