import { serverIconSrc } from '../../servers/lib/serverIcon'
import { rollNumbers, type ServerScene } from '../lib/serverLevelScene'
import './serverLevelUp.css'

const RING_R = 46
const RING_LEN = Math.round(2 * Math.PI * RING_R)

export interface ServerLevelUpViewProps {
  scene: ServerScene
  previous: number
  serverName: string
  iconUrl?: string
  /** Raio do ícone (px). */
  icon: number
  reduced: boolean
}

/** Ícone do servidor com o anel de progresso enchendo em volta. */
function IconWithRing({
  scene,
  serverName,
  iconUrl,
  icon,
  reduced
}: Omit<ServerLevelUpViewProps, 'previous'>): React.JSX.Element {
  const size = icon * 2
  return (
    <div
      className="relative shrink-0"
      style={{
        width: size,
        height: size,
        animation: reduced ? undefined : 'server-lvl-icon 1.4s cubic-bezier(.3,1.4,.5,1) both'
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute -inset-[18%] h-[136%] w-[136%] -rotate-90 overflow-visible"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r={RING_R} fill="none" stroke="#ffffff22" strokeWidth="4" />
        <circle
          cx="50"
          cy="50"
          r={RING_R}
          fill="none"
          stroke={scene.color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={RING_LEN}
          style={
            {
              '--ring-len': RING_LEN,
              filter: `drop-shadow(0 0 6px ${scene.color})`,
              animation: reduced ? undefined : 'server-lvl-ring 900ms ease-in 0ms both'
            } as React.CSSProperties
          }
        />
      </svg>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-[30%] bg-violet-600 text-white shadow-2xl"
        style={{ boxShadow: `0 0 ${icon}px ${scene.color}`, fontSize: icon * 0.9 }}
      >
        {iconUrl ? (
          <img src={serverIconSrc(iconUrl)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="font-black">{serverName.charAt(0).toUpperCase()}</span>
        )}
      </div>
    </div>
  )
}

/** O número do nível: conta do anterior até o novo e "explode". */
function LevelCount({
  scene,
  previous,
  reduced
}: Pick<ServerLevelUpViewProps, 'scene' | 'previous' | 'reduced'>): React.JSX.Element {
  const numbers = reduced ? [scene.level] : rollNumbers(previous, scene.level)
  const roll = numbers.length - 1
  const gradient = `linear-gradient(180deg, #ffffff 0%, ${scene.palette[0]} 55%, ${scene.palette[1] ?? scene.color} 100%)`
  return (
    <p
      className="font-black leading-none tracking-tight tabular-nums"
      style={{
        marginTop: '0.3em',
        fontSize: 'clamp(56px, 16vw, 128px)',
        filter: `drop-shadow(0 4px 28px ${scene.color})`,
        animation: reduced ? undefined : `server-lvl-number ${scene.durationMs}ms ease-out both`
      }}
    >
      <span className="relative inline-flex h-[1em] overflow-hidden">
        <span
          className="flex flex-col"
          style={
            {
              '--roll': roll,
              animation:
                roll > 0 ? 'level-roll 700ms cubic-bezier(.12,.8,.2,1) 0ms both' : undefined
            } as React.CSSProperties
          }
        >
          {numbers.map((n, i) => (
            // O degradê vai em cada número: o bg-clip-text do pai não acompanha o transform da contagem.
            <span
              key={i}
              aria-hidden={i < roll}
              className="block h-[1em] shrink-0 bg-clip-text text-transparent"
              style={{ backgroundImage: gradient }}
            >
              {n}
            </span>
          ))}
        </span>
      </span>
    </p>
  )
}

/**
 * O que a subida de nível do servidor mostra por cima do canvas: ícone com o
 * anel enchendo, a contagem do nível e o selo "Nível N do servidor" com o
 * nome do servidor (e o nome da cena nos marcos).
 */
function ServerLevelUpView(props: ServerLevelUpViewProps): React.JSX.Element {
  const { scene, serverName, reduced } = props
  return (
    <div className="flex w-full max-w-[min(92vw,640px)] flex-col items-center px-4 text-center">
      <IconWithRing {...props} />
      <LevelCount scene={scene} previous={props.previous} reduced={reduced} />
      <div
        className="mt-3 flex max-w-full flex-col items-center gap-1"
        style={{
          animation: reduced ? undefined : `server-lvl-badge ${scene.durationMs}ms ease-out both`
        }}
      >
        <p className="max-w-full truncate text-base font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,.8)] sm:text-lg">
          {serverName}
        </p>
        <p
          className="max-w-full truncate rounded-full border px-4 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white shadow-lg sm:text-xs sm:tracking-[0.3em]"
          style={{
            borderColor: `${scene.color}aa`,
            background: `linear-gradient(90deg, #1b1030dd, ${scene.color}88, #1b1030dd)`,
            textShadow: '0 1px 2px rgba(0,0,0,.7)'
          }}
        >
          Nível {scene.level} do servidor
          {scene.milestone ? ` · ${scene.title}` : ''}
        </p>
      </div>
    </div>
  )
}

export default ServerLevelUpView
