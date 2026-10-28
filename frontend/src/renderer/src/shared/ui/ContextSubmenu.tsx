import { useContextSubmenu } from '../hooks/useContextSubmenu'
import { submenuPanelStyle } from '../lib/submenuPlacement'
import { ChevronRightIcon } from './iconsExtra'

interface ContextSubmenuProps {
  /** Texto do item pai e nome acessível do painel. */
  label: string
  /** Classe do item pai (a mesma dos outros itens do menu). */
  triggerClass: string
  /** Os itens (`role="menuitem"` ou `menuitemcheckbox`) que aparecem no painel. */
  children: React.ReactNode
}

/**
 * Item de menu de contexto que abre um submenu ao lado (estilo Discord). Abre
 * com hover (atraso e tolerância na diagonal), clique, toque, Enter ou seta
 * para a direita; fecha com Esc ou seta para a esquerda, voltando o foco ao
 * item. Vai à direita, inverte para a esquerda se não couber; em tela estreita
 * cobre o menu pai e ganha um botão "Voltar". A lista longa rola no painel.
 *
 * A primeira passada de layout ainda não tem posição (0, 0): o hook mede e
 * posiciona antes da pintura, então ninguém vê. Não use `visibility: hidden`
 * nessa passada: elemento oculto não recebe foco.
 *
 * O painel é `fixed`: o `overflow` do menu pai não o corta. Vai dentro do menu
 * pai no DOM, então cliques nele contam como "dentro do menu".
 */
function ContextSubmenu({ label, triggerClass, children }: ContextSubmenuProps): React.JSX.Element {
  const { open, placement, setTrigger, setPanel, closeToTrigger, triggerProps, panelProps } =
    useContextSubmenu()
  const overlay = placement?.side === 'overlay'

  return (
    <>
      <button
        ref={setTrigger}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${triggerClass} flex items-center justify-between gap-2 pointer-coarse:py-2.5 ${open ? 'bg-fg/5' : ''}`}
        {...triggerProps}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
      </button>
      {open && (
        <div
          ref={setPanel}
          role="menu"
          aria-label={label}
          style={submenuPanelStyle(placement)}
          className="fixed z-10 flex max-h-[min(20rem,calc(100dvh-16px))] flex-col overflow-hidden rounded-lg border border-subtle bg-floating text-sm text-gray-200 shadow-2xl"
          {...panelProps}
        >
          {overlay && (
            <button
              type="button"
              role="menuitem"
              data-submenu-back=""
              onClick={closeToTrigger}
              className="flex min-h-10 shrink-0 cursor-pointer items-center gap-2 border-b border-subtle px-3 text-left font-semibold hover:bg-fg/5"
            >
              <ChevronRightIcon className="h-4 w-4 rotate-180" />
              Voltar
              <span className="ml-auto min-w-0 truncate text-xs font-bold text-gray-400">
                {label}
              </span>
            </button>
          )}
          <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2">
            {children}
          </div>
        </div>
      )}
    </>
  )
}

export default ContextSubmenu
