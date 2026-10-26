import { useEffect, useMemo } from 'react'
import { boostRank, shouldPlayBoostBanner } from '../lib/boost'
import { useBoostStore } from '../store/boostStore'
import { useCallStore } from '../../call/store/callStore'

/**
 * Banner de ativação do buff de XP (quando a call ganha buff ou sobe de rank).
 * A festa cresce com o rank (lib/boost.ts): A só desliza a letra; S pisca as
 * bordas; SS solta onda de choque e faíscas; SSS também faz flash dourado de
 * tela cheia, treme a janela e deixa a letra com glitch.
 */
function BoostBanner(): React.JSX.Element | null {
  const stored = useBoostStore((s) => s.celebration)
  const callId = useCallStore((s) => s.callId)
  const paused = useCallStore((s) => s.muted || s.deafened)
  // Fora da call do buff, ou mutado/surdo (não ganha o buff), não toca.
  const celebration =
    stored && shouldPlayBoostBanner(paused, stored.callId, callId) ? stored : null
  const rank = celebration ? boostRank(celebration.percent) : null

  // SSS: a janela treme uma vez no slam.
  const quake = rank?.quake ?? false
  const key = celebration?.key
  useEffect(() => {
    if (key === undefined || !quake) return
    document.body.classList.add('boost-quake')
    const timer = setTimeout(() => document.body.classList.remove('boost-quake'), 600)
    return () => {
      clearTimeout(timer)
      document.body.classList.remove('boost-quake')
    }
  }, [key, quake])

  const sparks = useMemo(() => {
    if (!rank) return []
    return Array.from({ length: rank.sparks }, (_, i) => {
      const angle = ((i / Math.max(1, rank.sparks)) * 360 + (i % 2) * 11) * (Math.PI / 180)
      const reach = 70 + ((i * 37) % 70)
      return {
        dx: Math.cos(angle) * reach,
        dy: Math.sin(angle) * reach * 0.6,
        size: 3 + (i % 3),
        delay: 120 + (i % 5) * 40
      }
    })
  }, [rank])

  if (!celebration || !rank) return null

  const vars = {
    '--boost-color': rank.color,
    '--boost-accent': rank.accent
  } as React.CSSProperties

  return (
    <div
      key={celebration.key}
      role="status"
      aria-label={`Buff de XP ${rank.label}: ${rank.text}`}
      className="pointer-events-none fixed inset-0 z-50"
      style={vars}
    >
      {rank.screenFlash && (
        <span
          aria-hidden="true"
          className="boost-flash boost-motion absolute inset-0"
          style={{ animation: `boost-flash ${rank.durationMs}ms ease-out both` }}
        />
      )}
      {rank.edgeFlash && (
        <span
          aria-hidden="true"
          className="boost-edge boost-motion absolute inset-0"
          style={{ animation: `boost-edge ${Math.min(1400, rank.durationMs)}ms ease-out both` }}
        />
      )}

      <div
        className="boost-anim absolute left-0 top-[calc(var(--titlebar-height,0px)+5rem)]"
        style={{ animation: `boost-banner ${rank.durationMs}ms ease-in-out both` }}
      >
        <div className="relative flex items-center gap-4 py-2 pl-6 pr-12">
          {/* Fundo recortado numa camada própria: o clip-path cortaria o anel e as faíscas. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ filter: `drop-shadow(0 0 15px ${rank.color}88)` }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, ${rank.accent}f2, #0b0b10f2 70%)`,
                borderBottom: `3px solid ${rank.color}`,
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%)'
              }}
            />
          </div>

          <span className="relative flex items-center justify-center">
            {rank.ring && (
              <span
                aria-hidden="true"
                className="boost-ring boost-motion absolute left-1/2 top-1/2 h-16 w-16"
                style={{ animation: 'boost-ring 0.9s ease-out 0.25s both' }}
              />
            )}
            <span className="boost-letter text-6xl" data-stage={rank.stage}>
              {rank.letter}
            </span>
          </span>

          <div className="relative leading-tight">
            <p className="boost-text text-lg">{rank.text}</p>
            <p className="text-xs font-bold text-gray-200">
              XP {rank.label}
              {celebration.eligible > 0 && ` · ${celebration.eligible} pessoas`}
            </p>
          </div>

          {sparks.map((spark, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="boost-motion absolute left-14 top-1/2 rounded-full"
              style={
                {
                  '--dx': `${spark.dx}px`,
                  '--dy': `${spark.dy}px`,
                  width: spark.size,
                  height: spark.size,
                  background: i % 2 === 0 ? rank.color : '#ffffff',
                  boxShadow: `0 0 6px ${rank.color}`,
                  animation: `boost-spark 1s ease-out ${spark.delay}ms both`
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default BoostBanner
