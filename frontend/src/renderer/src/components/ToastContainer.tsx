import { useToastStore } from '../store/toastStore'

export function ToastContainer(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return <></>

  return (
    <div className="pointer-events-none fixed top-[calc(var(--titlebar-height,0px)+1rem)] right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success'
        const isError = toast.type === 'error'

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
              isSuccess
                ? 'border-emerald-500/30 bg-[#07150e]/90 text-emerald-200'
                : isError
                  ? 'border-red-500/30 bg-[#170709]/90 text-red-200'
                  : 'border-violet-500/30 bg-[#0d0917]/90 text-violet-200'
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="shrink-0 text-base">{isSuccess ? '✅' : isError ? '❌' : 'ℹ️'}</span>
              <p className="truncate text-xs font-semibold leading-relaxed">{toast.message}</p>
            </div>

            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run()
                  removeToast(toast.id)
                }}
                className="shrink-0 cursor-pointer rounded-md border border-white/15 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/10"
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default ToastContainer
