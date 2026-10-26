import { useProfileStore } from '../store/profileStore'
import { nameGraphemes, nameStyleCss, resolveNameStyle, type NameStyle } from '../lib/nameStyle'
import '../../../assets/nameStyle.css'

/**
 * Nome de exibição com a fonte/efeito que a pessoa escolheu. O estilo mais novo
 * vem do perfil conhecido (evento user:update); sem ele, vale o `style` que veio
 * junto com a mensagem/membro; sem nenhum, é o texto normal.
 * Só para o nome de exibição: apelido de servidor não leva estilo. `style={null}`
 * diz que há apelido em uso (sem estilo, nem o do perfil ao vivo).
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
  const resolved = resolveNameStyle(style === null ? null : (live ?? style))
  const css = nameStyleCss(resolved)
  const classes = [className, css.className].filter(Boolean).join(' ') || undefined

  if (css.letters) {
    // Onda: cada letra num span com atraso próprio (só CSS anima). O leitor de
    // tela lê o nome inteiro, não letra por letra.
    return (
      <span className={classes} style={css.style}>
        <span className="sr-only">{name}</span>
        {nameGraphemes(name).map((ch, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="name-wave-ch"
            style={{ '--i': i } as React.CSSProperties}
          >
            {ch}
          </span>
        ))}
      </span>
    )
  }

  const extra =
    resolved.effect === 'typewriter'
      ? { ...css.style, '--name-steps': Math.max(1, nameGraphemes(name).length) }
      : css.style
  return (
    <span className={classes} style={extra} data-text={css.copy ? name : undefined}>
      {name}
    </span>
  )
}
