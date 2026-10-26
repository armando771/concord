import { useProfileStore } from '../store/profileStore'
import { nameStyleCss, resolveNameStyle, type NameStyle } from '../lib/nameStyle'
import '../assets/nameStyle.css'

/**
 * Nome de exibição com a fonte/efeito que a pessoa escolheu. O estilo mais novo
 * vem do perfil conhecido (evento user:update); sem ele, vale o `style` que veio
 * junto com a mensagem/membro; sem nenhum, é o texto normal.
 * Só para o nome de exibição: apelido de servidor não leva estilo.
 */
export default function StyledName({
  name,
  userId,
  style,
  className = ''
}: {
  name: string
  userId?: string
  style?: Partial<NameStyle> | null
  className?: string
}): React.JSX.Element {
  const live = useProfileStore((s) => (userId ? s.profiles[userId]?.name_style : undefined))
  const resolved = resolveNameStyle(live ?? style)
  const css = nameStyleCss(resolved)
  const classes = [className, css.className].filter(Boolean).join(' ')
  return (
    <span className={classes || undefined} style={css.style}>
      {name}
    </span>
  )
}
