import { levelTier } from '../../levels/lib/levels'
import { levelBadgeStyle } from '../../levels/lib/levelBadgeStyle'
import '../../levels/components/levelSpecial.css'

/** "Nv 12" com a cor da faixa do nível (ou o selo especial: 13, 14, 22, 24). */
function LevelChip({ level }: { level: number }): React.JSX.Element {
  const look = levelBadgeStyle(level)
  return (
    <span
      title={`Nível ${level} · ${levelTier(level).name}`}
      data-badge={look.variant}
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${look.className}`}
      style={look.style}
    >
      Nv {level}
    </span>
  )
}

export default LevelChip
