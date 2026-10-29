import { useEffect, useMemo, useRef } from 'react'
import { useServerStore } from '../../servers/store/serverStore'
import { useCallStore } from '../../call/store/callStore'
import { prefersReducedMotion, runScene } from '../../levels/lib/sceneRunner'
import { serverLevelScene } from '../lib/serverLevelScene'
import { buildServerScene, serverSceneLayout } from '../lib/serverSceneCanvas'
import { useServerLevelUpStore } from '../store/serverLevelUpStore'
import ServerLevelUpView from './ServerLevelUpView'

/**
 * Fecha a animação `key`: no fim dela, com Esc ou com um clique/toque em
 * qualquer lugar. Os ouvintes não param o evento (o clique segue para o app)
 * e nada pega o foco: a call e o chat continuam usáveis por baixo.
 */
function useDismiss(key: number | undefined, durationMs: number): void {
  useEffect(() => {
    if (key === undefined) return
    const close = (): void => useServerLevelUpStore.getState().close(key)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    const timer = setTimeout(close, durationMs)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', close)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', close)
    }
  }, [key, durationMs])
}

/**
 * Subida de nível do SERVIDOR, para quem está nele (regra em
 * serverLevelCelebration): overlay em tela cheia, não-modal, com o canvas da
 * cena da faixa (serverLevelScene) e o ícone, a contagem e o selo por cima.
 * Com prefers-reduced-motion: sem canvas e sem movimento, só aparece e some.
 */
function ServerLevelUpOverlay(): React.JSX.Element | null {
  const current = useServerLevelUpStore((s) => s.current)
  const server = useServerStore((s) => s.servers.find((x) => x.id === current?.serverId))
  const scene = useMemo(() => (current ? serverLevelScene(current.level) : null), [current])
  const key = current?.key
  const reduced = useMemo(() => key !== undefined && prefersReducedMotion(), [key])
  const size = useMemo(
    () => (key === undefined ? null : { w: window.innerWidth, h: window.innerHeight }),
    [key]
  )
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useDismiss(key, scene?.durationMs ?? 0)

  // O que o canvas desenha (nada com movimento reduzido).
  const playing = useMemo(
    () => (scene && size && !reduced ? { scene, size } : null),
    [scene, size, reduced]
  )
  useEffect(() => {
    if (!canvasRef.current || !playing) return
    return runScene(canvasRef.current, {
      ...playing.size,
      durationMs: playing.scene.durationMs,
      dpr: window.devicePixelRatio,
      inCall: useCallStore.getState().status === 'active',
      build: () => buildServerScene(playing.scene, playing.size.w, playing.size.h)
    })
  }, [playing])

  if (!current || !scene || !size) return null
  const { cy, icon } = serverSceneLayout(size.w, size.h)

  return (
    <div
      key={current.key}
      role="status"
      aria-label={`${server?.name ?? 'O servidor'} subiu para o nível ${scene.level}`}
      data-server-scene={scene.milestone ?? scene.band}
      className={`level-anim pointer-events-none fixed inset-0 z-40 overflow-hidden ${reduced ? 'level-fade' : ''}`}
      style={
        {
          '--level-fade-ms': `${scene.durationMs}ms`,
          '--shake': `${scene.shake}px`,
          animation: reduced ? undefined : `server-lvl-out ${scene.durationMs}ms linear both`
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(8,4,20,.55), rgba(8,4,20,.2) 65%, transparent)',
          animation: scene.shake > 0 && !reduced ? 'level-shake 700ms linear 650ms both' : undefined
        }}
      >
        {!reduced && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}
        <div className="absolute inset-x-0 flex justify-center" style={{ top: cy - icon }}>
          <ServerLevelUpView
            scene={scene}
            previous={current.previous}
            serverName={server?.name ?? 'Servidor'}
            iconUrl={server?.icon_url}
            icon={icon}
            reduced={reduced}
          />
        </div>
      </div>
    </div>
  )
}

export default ServerLevelUpOverlay
