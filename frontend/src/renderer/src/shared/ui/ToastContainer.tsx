import { XIcon } from './icons'
import { useToastStore, type ToastMessage, type ToastType } from '../store/toastStore'

const ESTILO: Record<ToastType, { borda: string; fundo: string; icone: string; rotulo: string }> = {
  success: { borda: 'border-success/30', fundo: 'bg-success/15', icone: 'text-success', rotulo: 'Sucesso' },
  error: { borda: 'border-danger/30', fundo: 'bg-danger/15', icone: 'text-danger', rotulo: 'Erro' },
  warning: { borda: 'border-warning/30', fundo: 'bg-warning/15', icone: 'text-warning', rotulo: 'Alerta' },
  info: { borda: 'border-brand/30', fundo: 'bg-brand/15', icone: 'text-link', rotulo: 'Informação' }
}

const CAMINHO_ICONE: Record<ToastType, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 6l12 12M18 6L6 18',
  warning: 'M12 8v5M12 16.5v.5',
  info: 'M12 11v5M12 7.5v.5'
}

function Icone({ type }: { type: ToastType }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`size-3.5 ${ESTILO[type].icone}`}
    >
      <path d={CAMINHO_ICONE[type]} />
    </svg>
  )
}

export function Toast({ toast }: { toast: ToastMessage }): React.JSX.Element {
  const removeToast = useToastStore((s) => s.removeToast)
  const estilo = ESTILO[toast.type]

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-xl border ${estilo.borda} bg-floating p-3 shadow-2xl backdrop-blur-md ${
        toast.leaving ? 'toast-out' : 'toast-in'
      }`}
    >
      <span className="sr-only">{estilo.rotulo}: </span>
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${estilo.fundo}`}
      >
        <Icone type={toast.type} />
      </span>
      <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-strong">{toast.message}</p>

      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.run()
            removeToast(toast.id)
          }}
          className="shrink-0 cursor-pointer rounded-md border border-normal px-2 py-1 text-xs font-semibold text-strong transition-colors hover:bg-fg/10"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-fg/10 hover:text-strong"
        title="Fechar"
        aria-label="Fechar"
      >
        <XIcon size={16} className="size-3.5" />
      </button>
    </div>
  )
}

export function ToastContainer(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts)

  // Sempre montado (vazio, sem cliques): leitor de tela só anuncia o que entra
  // numa região aria-live que já existia.
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-[calc(var(--titlebar-height,0px)+1rem)] z-[100] flex flex-col gap-2 sm:left-auto sm:w-full sm:max-w-sm"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

export default ToastContainer
