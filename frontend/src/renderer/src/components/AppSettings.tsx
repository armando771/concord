import { useEffect, useState } from 'react'
import type { NotificationPrefs } from '../lib/notifications'
import { getBirthday, setBirthday, type Birthday } from '../api/birthdays'
import { birthdayError } from '../lib/birthday'
import { showToast } from '../store/toastStore'
import BirthdayFields from './BirthdayFields'
import { useNotificationPrefsStore } from '../store/notificationPrefsStore'
import { useOverlayPrefsStore } from '../store/overlayPrefsStore'

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

/** Perfil: aniversário (opcional) e se os servidores podem anunciar. */
function ProfileSettings(): React.JSX.Element {
  const [birthday, setLocal] = useState<Birthday | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getBirthday()
      .then(setLocal)
      .catch(() => setLocal({ day: null, month: null, announce: true }))
  }, [])

  const save = async (next: Birthday): Promise<void> => {
    setLocal(next)
    // Só salva quando dá: os dois vazios ou dia e mês escolhidos.
    if (birthdayError(next)) return
    setSaving(true)
    try {
      setLocal(await setBirthday(next))
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Não foi possível salvar o aniversário.')
    } finally {
      setSaving(false)
    }
  }

  if (!birthday) return <div className="rounded-xl border border-white/10 bg-white/5 p-4" />

  const error = birthdayError(birthday)

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Perfil</h3>
      <div className="flex flex-col gap-3">
        <BirthdayFields
          value={birthday}
          onChange={(value) => void save({ ...birthday, ...value })}
        />
        {error && <p className="text-xs text-amber-300">{error}</p>}
        <Toggle
          title="Anunciar meu aniversário nos servidores"
          description="No seu dia, os servidores mandam uma mensagem de parabéns no canal principal e você vê um recado ao abrir o app."
          checked={birthday.announce}
          onChange={() => void save({ ...birthday, announce: !birthday.announce })}
        />
        {saving && <p className="text-[11px] text-gray-500">Salvando…</p>}
      </div>
    </div>
  )
}

/** Preferências do app desktop (só aparece onde há suporte, ex.: Windows). */
function AppSettings(): React.JSX.Element | null {
  const background = window.api?.background
  // undefined = ainda carregando; null = não suportado nesta plataforma
  const [autostart, setAutostart] = useState<boolean | null | undefined>(undefined)
  const prefs = useNotificationPrefsStore()
  const overlayEnabled = useOverlayPrefsStore((s) => s.enabled)
  const setOverlayEnabled = useOverlayPrefsStore((s) => s.setEnabled)

  useEffect(() => {
    void background?.getAutostart().then(setAutostart)
  }, [background])

  if (!background) {
    return (
      <div className="flex flex-col gap-4">
        <ProfileSettings />
      </div>
    )
  }

  const toggleAutostart = (): void => {
    void background.setAutostart(!autostart).then((value) => {
      if (value !== null) setAutostart(value)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <ProfileSettings />
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
      {window.api?.overlay?.supported && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <Toggle
            title="Overlay nos jogos"
            description="Mostra quem está na chamada e quem está falando por cima de jogos em tela cheia (modo janela)."
            checked={overlayEnabled}
            onChange={() => setOverlayEnabled(!overlayEnabled)}
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
