import { useEffect, useState } from 'react'

const DISMISS_KEY = 'salinha.autoUpdateNoticeDismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Linux sem AppImage (ex.: AppImage extraído por falta do FUSE 2): o app nunca
 * acha versão nova. Avisa uma vez para a pessoa saber que precisa baixar.
 */
function AutoUpdateUnavailableNotice(): React.JSX.Element | null {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const check = window.api?.updates?.autoUpdateUnavailable
    if (!check || readDismissed()) return
    check()
      .then(setShow)
      .catch(() => {})
  }, [])

  if (!show) return null

  const dismiss = (): void => {
    setShow(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // sem storage: volta a avisar na próxima vez
    }
  }

  return (
    <div
      role="status"
      className="pointer-events-auto w-full rounded-xl border border-amber-400/40 bg-floating p-4 shadow-2xl backdrop-blur"
    >
      <p className="text-sm font-semibold text-strong">
        Atualização automática indisponível nesta instalação
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Use o AppImage sem extrair (precisa do pacote fuse2/libfuse2) ou baixe as versões novas pelo
        site.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2 cursor-pointer text-xs font-semibold text-gray-300 hover:text-strong"
      >
        Entendi
      </button>
    </div>
  )
}

export default AutoUpdateUnavailableNotice
