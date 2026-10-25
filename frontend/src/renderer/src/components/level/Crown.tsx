import { RAINBOW } from '../../lib/levels'

/** Coroa de arco-íris da faixa Lendária (celebração e marco do 100). */
function Crown({ size = 96 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={(size * 72) / 96} viewBox="0 0 96 72" aria-hidden="true">
      <defs>
        <linearGradient id="level-crown-fill" x1="0" y1="0" x2="1" y2="0">
          {RAINBOW.map((color, i) => (
            <stop key={color} offset={i / (RAINBOW.length - 1)} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <path
        d="M6 62 L12 18 L32 40 L48 6 L64 40 L84 18 L90 62 Z"
        fill="url(#level-crown-fill)"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="6" y="60" width="84" height="9" rx="3" fill="#fff" />
      {[12, 48, 84].map((x, i) => (
        <circle key={x} cx={x} cy={i === 1 ? 6 : 18} r="5" fill="#fff" />
      ))}
    </svg>
  )
}

export default Crown
