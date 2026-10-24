import { useEffect, useState } from 'react'
import type { NotificationPrefs } from '../lib/notifications'
import { useNotificationPrefsStore } from '../store/notificationPrefsStore'

function Toggle({
  title,
  description,
  checked,
  onChange
}: {
  title: string
  description: string
  checked: boolean
  onChange: () => void
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="block text-xs text-gray-400">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-[#23a55a]"
      />
    </label>
  )
}

const NOTIFICATION_OPTIONS: { key: keyof NotificationPrefs; title: string; description: string }[] =
  [
    {
      key: 'taskbar',
      title: 'Mostrar na barra de tarefas',
      description: 'Pisca a Salinha e mostra quantas mensagens chegaram enquanto você não olhava.'
    },
    {
      key: 'desktop',
      title: 'Notificações na área de trabalho',
      description: 'Mostra um aviso do Windows com a mensagem recebida.'
    },
    {
      key: 'sound',
      title: 'Som de notificação',
      description: 'Toca um som ao receber uma DM ou ser mencionado.'
    }
  ]

/** Preferências do app desktop (só aparece onde há suporte, ex.: Windows). */
function AppSettings(): React.JSX.Element | null {
  const background = window.api?.background
  // undefined = ainda carregando; null = não suportado nesta plataforma
  const [autostart, setAutostart] = useState<boolean | null | undefined>(undefined)
  const prefs = useNotificationPrefsStore()

  useEffect(() => {
    void background?.getAutostart().then(setAutostart)
  }, [background])

  if (!background) return null

  const toggleAutostart = (): void => {
    void background.setAutostart(!autostart).then((value) => {
      if (value !== null) setAutostart(value)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {typeof autostart === 'boolean' && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <Toggle
            title="Iniciar com o Windows"
            description="Abre escondido na bandeja, pronto para receber chamadas."
            checked={autostart}
            onChange={toggleAutostart}
          />
        </div>
      )}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">
          Notificações
        </h3>
        <div className="flex flex-col gap-3">
          {NOTIFICATION_OPTIONS.map((option) => (
            <Toggle
              key={option.key}
              title={option.title}
              description={option.description}
              checked={prefs[option.key]}
              onChange={() => prefs.setPref(option.key, !prefs[option.key])}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default AppSettings
