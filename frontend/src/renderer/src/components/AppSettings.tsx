import { useEffect, useState } from 'react'
import type { NotificationPrefs } from '../lib/notifications'
import { OVERLAY_OPACITY_MAX, OVERLAY_OPACITY_MIN, OVERLAY_OPACITY_STEP } from '../lib/overlayState'
import { getBirthday, setBirthday, type Birthday } from '../api/birthdays'
import { birthdayError } from '../lib/birthday'
import { showToast } from '../store/toastStore'
import BirthdayFields from './BirthdayFields'
import { useNotificationPrefsStore } from '../store/notificationPrefsStore'
import { useOverlayPrefsStore } from '../store/overlayPrefsStore'
import LevelUpPreview from './level/LevelUpPreview'

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
      .catch(() => setLocal({ day: null, month: null, year: null, announce: true }))
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
        <p className="text-[11px] text-gray-500">
          Sua idade aparece só para você, no recado de feliz aniversário.
        </p>
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
  const overlayOpacity = useOverlayPrefsStore((s) => s.opacity)
  const setOverlayOpacity = useOverlayPrefsStore((s) => s.setOpacity)
  const overlayMoved = useOverlayPrefsStore(
    (s) => s.layout.position !== null || s.layout.scale !== 1
  )
  const resetOverlayLayout = useOverlayPrefsStore((s) => s.resetLayout)

  useEffect(() => {
    void background?.getAutostart().then(setAutostart)
  }, [background])

  // Prévia da animação de nível: só no build de dev (some do build final).
  const devPreview = import.meta.env.DEV ? <LevelUpPreview /> : null

  if (!background) {
    return (
      <div className="flex flex-col gap-4">
        <ProfileSettings />
        {devPreview}
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
      {/* Overlay de jogo: só Windows (preload: process.platform, sandbox desligado). */}
      {window.api?.overlay?.supported && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Overlay</h3>
          <Toggle
            title="Overlay nos jogos"
            description="Mostra quem está na chamada e quem está falando por cima de jogos em tela cheia (modo janela)."
            checked={overlayEnabled}
            onChange={() => setOverlayEnabled(!overlayEnabled)}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">
              Atalho: <kbd className="font-semibold text-gray-200">Shift+Tab</kbd> para mover e
              redimensionar o overlay durante o jogo
            </span>
            <button
              type="button"
              onClick={resetOverlayLayout}
              disabled={!overlayMoved}
              className="shrink-0 cursor-pointer rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15 disabled:cursor-default disabled:opacity-50"
            >
              Restaurar posição
            </button>
          </div>
          <label className="mt-4 flex flex-col gap-2">
            <span className="flex items-center justify-between text-sm font-semibold text-white">
              Opacidade do overlay (quem fala fica mais visível)
              <span className="text-xs font-medium text-gray-400">{overlayOpacity}%</span>
            </span>
            <input
              type="range"
              min={OVERLAY_OPACITY_MIN}
              max={OVERLAY_OPACITY_MAX}
              step={OVERLAY_OPACITY_STEP}
              value={overlayOpacity}
              disabled={!overlayEnabled}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              aria-label="Opacidade do overlay"
              className="accent-[#23a55a] disabled:opacity-40"
            />
            <span className="text-xs text-gray-400">
              Bem fraquinho em repouso para não atrapalhar o jogo; quem está falando aparece mais
              forte.
            </span>
          </label>
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
      {devPreview}
    </div>
  )
}

export default AppSettings
