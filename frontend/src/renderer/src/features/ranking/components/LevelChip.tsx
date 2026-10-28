import { levelTier } from '../../levels/lib/levels'

/** "Nv 12" com a cor da faixa do nível (Bronze, Prata, Ouro...). */
function LevelChip({ level }: { level: number }): React.JSX.Element {
  const tier = levelTier(level)
  return (
    <span
      title={`Nível ${level} · ${tier.name}`}
      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-black/80"
      style={{ backgroundImage: `linear-gradient(135deg, ${tier.color}, ${tier.accent})` }}
    >
      Nv {level}
    </span>
  )
}

export default LevelChip
