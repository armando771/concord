import { useLevelStore } from '../store/levelStore'
import { boostRank } from '../lib/boost'
import StyleRank from './StyleRank'
import { useMyBoostPercent } from '../hooks/useMyBoost'
import { formatVoiceTime, levelPercent, levelTier, minutesToNext } from '../lib/levels'

/** Barra de XP de quem está logado, no painel "Voz conectada". */
function VoiceXPBar({ paused }: { paused: boolean }): React.JSX.Element | null {
  const me = useLevelStore((s) => s.me)
  const boostPercent = useMyBoostPercent()
  if (!me) return null

  const rank = boostRank(boostPercent)

  const tier = levelTier(me.level)
  const percent = levelPercent(me.xp_into_level, me.xp_for_next)
  const minutes = minutesToNext(me.xp_into_level, me.xp_for_next)

  return (
    <div
      className="mt-2 px-0.5"
      title={`${formatVoiceTime(me.voice_seconds)} de call no total · faltam ~${minutes} min para o nível ${me.level + 1}`}
    >
      {rank && <StyleRank percent={boostPercent} paused={paused} className="mb-1" />}
      <div className="mb-1 flex items-baseline justify-between text-[10px]">
        <span className="font-bold" style={{ color: paused ? 'var(--text-faint)' : tier.color }}>
          Nível {me.level}
        </span>
        <span className="text-gray-500">
          {paused ? 'XP pausado (mutado)' : `${me.xp_into_level}/${me.xp_for_next} XP`}
        </span>
      </div>
      <div className="relative">
        <div className="h-1.5 overflow-hidden rounded-full bg-fg/10">
          <div
            className="relative h-full overflow-hidden rounded-full transition-[width] duration-700"
            style={{
              width: `${percent}%`,
              backgroundImage: paused
                ? 'linear-gradient(90deg, #4b5563, #374151)'
                : `linear-gradient(90deg, ${tier.accent}, ${tier.color})`,
              boxShadow: paused ? undefined : `0 0 8px ${tier.color}88`
            }}
          >
            {rank && !paused && (
              <span
                aria-hidden="true"
                className="boost-shine boost-motion absolute inset-y-0 w-1/4"
                style={
                  { '--boost-shine-ms': `${2400 - rank.stage * 400}ms` } as React.CSSProperties
                }
              />
            )}
          </div>
        </div>
        {rank &&
          rank.stage >= 3 &&
          !paused &&
          Array.from({ length: rank.stage === 3 ? 4 : 7 }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="boost-ember boost-motion pointer-events-none absolute -top-0.5 h-[3px] w-[3px] rounded-full"
              style={
                {
                  left: `${10 + ((i * 53) % 80)}%`,
                  background: rank.color,
                  boxShadow: `0 0 4px ${rank.color}`,
                  '--dx': `${(i % 2 === 0 ? 1 : -1) * (3 + ((i * 7) % 8))}px`,
                  '--delay': `${i * 230}ms`
                } as React.CSSProperties
              }
            />
          ))}
      </div>
    </div>
  )
}

export default VoiceXPBar
