import { useEffect, useState } from 'react'

/** Preferências do app desktop (só aparece onde há suporte, ex.: Windows). */
function AppSettings(): React.JSX.Element | null {
  const background = window.api?.background
  const [autostart, setAutostart] = useState<boolean | null>(null)

  useEffect(() => {
    void background?.getAutostart().then(setAutostart)
  }, [background])

  if (!background || autostart === null) return null

  const toggle = (): void => {
    void background.setAutostart(!autostart).then((value) => {
      if (value !== null) setAutostart(value)
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-white">Iniciar com o Windows</span>
          <span className="block text-xs text-gray-400">
            Abre escondido na bandeja, pronto para receber chamadas.
          </span>
        </span>
        <input
          type="checkbox"
          checked={autostart}
          onChange={toggle}
          className="h-4 w-4 accent-[#23a55a]"
        />
      </label>
    </div>
  )
}

export default AppSettings
