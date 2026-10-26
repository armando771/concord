import { useEffect, useRef } from 'react'
import { holoPointer } from '../../lib/badges'

interface MythicIconProps {
  src: string
  size: number
  /**
   * hero: a arte grande do modal (segue o mouse, partículas em órbita e um
   * clarão ao aparecer). Sem hero: só aura e brilho passando (fileira,
   * grade, toast).
   */
  hero?: boolean
  className?: string
}

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Arte de raridade mítica: aura prismática girando atrás, folha holográfica
 * por cima (recortada no formato da arte com mask-image) e, no hero,
 * inclinação 3D seguindo o mouse. Tudo em CSS (main.css, .mythic-*); o JS
 * só escreve variáveis no pointermove, uma vez por quadro, sem re-render.
 */
function MythicIcon({
  src,
  size,
  hero = false,
  className = ''
}: MythicIconProps): React.JSX.Element {
  const ref = useRef<HTMLSpanElement | null>(null)
  const frame = useRef(0)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const onMove = (e: React.PointerEvent<HTMLSpanElement>): void => {
    const el = ref.current
    if (!el || frame.current || reducedMotion()) return
    const { clientX, clientY } = e
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const p = holoPointer(clientX, clientY, el.getBoundingClientRect())
      el.style.setProperty('--mx', `${p.mx}%`)
      el.style.setProperty('--my', `${p.my}%`)
      el.style.setProperty('--rx', `${p.rx}deg`)
      el.style.setProperty('--ry', `${p.ry}deg`)
      el.dataset.hover = 'true'
    })
  }

  const onLeave = (): void => {
    const el = ref.current
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = 0
    if (!el) return
    for (const v of ['--mx', '--my', '--rx', '--ry']) el.style.removeProperty(v)
    delete el.dataset.hover
  }

  const mask = `url("${src}")`
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`mythic-icon ${hero ? 'mythic-icon--hero' : ''} ${className}`}
      style={{ width: size, height: size }}
      onPointerMove={hero ? onMove : undefined}
      onPointerLeave={hero ? onLeave : undefined}
    >
      <span className="mythic-icon__aura" />
      {hero && (
        <>
          <span className="mythic-icon__orbit mythic-icon__orbit--a">
            <i />
          </span>
          <span className="mythic-icon__orbit mythic-icon__orbit--b">
            <i />
          </span>
          <span className="mythic-icon__orbit mythic-icon__orbit--c">
            <i />
          </span>
        </>
      )}
      <span className="mythic-icon__card">
        <img
          src={src}
          alt=""
          draggable={false}
          width={size}
          height={size}
          className="mythic-icon__art select-none object-contain"
        />
        <span className="mythic-icon__foil" style={{ WebkitMaskImage: mask, maskImage: mask }} />
      </span>
      {hero && <span className="mythic-icon__flash" />}
    </span>
  )
}

export default MythicIcon
