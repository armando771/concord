import { useEffect, useState } from 'react'
import type { NotificationPrefs } from '../../notifications/lib/notifications'
import { useNotificationPrefsStore } from '../../notifications/store/notificationPrefsStore'
import OverlaySettings from '../../overlay/components/OverlaySettings'
import { IS_WEB } from '../../../shared/lib/config'
import { permissionView, type WebPermission } from '../../notifications/lib/webNotifications'
import { browserPermission, requestBrowserPermission } from '../../notifications/lib/browserNotifications'
import LevelUpPreview from '../../levels/components/LevelUpPreview'
import { Toggle } from './Toggle'
import MutedNotifications from '../../notifications/components/MutedNotifications'

type NotificationOption = { key: keyof NotificationPrefs; title: string; description: string }

const SOUND_OPTION: NotificationOption = {
  key: 'sound',
  title: 'Som de notificação',
  description: 'Toca um som ao receber uma DM ou ser mencionado.'
}

const NOTIFICATION_OPTIONS: NotificationOption[] = IS_WEB
  ? [
      {
        key: 'taskbar',
        title: 'Mostrar no título da aba',
        description: 'Mostra quantas mensagens chegaram enquanto você não olhava, ex.: (3) Salinha.'
      },
      {
        key: 'desktop',
        title: 'Notificações do navegador',
        description: 'Mostra um aviso do navegador com a mensagem recebida.'
      },
      SOUND_OPTION
    ]
  : [
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
      SOUND_OPTION
    ]

/** Permissão do navegador para os avisos (só no build web). */
function BrowserPermission(): React.JSX.Element {
  const [permission, setPermission] = useState<WebPermission>(browserPermission)
  const view = permissionView(permission)

  // Mudou nas permissões do site (cadeado da barra de endereço): acompanha.
  useEffect(() => {
    let status: PermissionStatus | undefined
    const update = (): void => setPermission(browserPermission())
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then((result) => {
        status = result
        status.addEventListener('change', update)
      })
      .catch(() => {})
    return () => status?.removeEventListener('change', update)
  }, [])

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-input px-3 py-2">
      <span className="text-xs text-gray-400">{view.status}</span>
      {view.canRequest && (
        <button
          type="button"
          onClick={() => void requestBrowserPermission().then(setPermission)}
          className="shrink-0 cursor-pointer rounded-md bg-success-strong px-3 py-1.5 text-ds-sm font-medium text-white transition-colors hover:bg-success-strong-hover"
        >
          Permitir notificações
        </button>
      )}
    </div>
  )
}

/** Configurações → Notificações. */
export function NotificationSettings(): React.JSX.Element {
  const prefs = useNotificationPrefsStore()
  return (
    <>
      <div className="rounded-xl border border-subtle bg-fg/5 p-4">
        <div className="flex flex-col gap-4">
          {IS_WEB && <BrowserPermission />}
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
      <MutedNotifications />
    </>
  )
}

/**
 * Configurações → Aplicativo: iniciar com o sistema e overlay (só onde há
 * suporte, ex.: Windows).
 */
export function DesktopSettings(): React.JSX.Element {
  const background = window.api?.background
  // undefined = ainda carregando; null = não suportado nesta plataforma
  const [autostart, setAutostart] = useState<boolean | null | undefined>(undefined)
  // Linux: null = sem bandeja (ou outra plataforma); undefined = carregando.
  const [closeToTray, setCloseToTray] = useState<
    { enabled: boolean; available: boolean } | null | undefined
  >(undefined)

  useEffect(() => {
    void background?.getAutostart().then(setAutostart)
    void background?.getCloseToTray?.().then(setCloseToTray)
  }, [background])

  const toggleAutostart = (): void => {
    void background?.setAutostart(!autostart).then((value) => {
      if (value !== null) setAutostart(value)
    })
  }

  const toggleCloseToTray = (): void => {
    if (!closeToTray) return
    void background?.setCloseToTray(!closeToTray.enabled).then((value) => {
      if (value !== null) setCloseToTray({ ...closeToTray, enabled: value })
    })
  }

  const hasCloseToTray = Boolean(background) && Boolean(closeToTray)
  const hasAutostart = Boolean(background) && typeof autostart === 'boolean'
  const hasOverlay = Boolean(background && window.api?.overlay?.supported)

  return (
    <div className="flex flex-col gap-4">
      {hasAutostart && (
        <div className="rounded-xl border border-subtle bg-fg/5 p-4">
          <Toggle
            title="Iniciar com o Windows"
            description="Abre escondido na bandeja, pronto para receber chamadas."
            checked={Boolean(autostart)}
            onChange={toggleAutostart}
          />
        </div>
      )}
      {/* Linux: a bandeja depende do painel (Waybar, KDE, extensão do GNOME). */}
      {hasCloseToTray && closeToTray && (
        <div className="rounded-xl border border-subtle bg-fg/5 p-4">
          <Toggle
            title="Minimizar para a bandeja ao fechar"
            description={
              closeToTray.available
                ? 'Fechar a janela deixa a Salinha na bandeja, pronta para receber chamadas.'
                : 'Seu painel não está mostrando ícones de bandeja agora: enquanto isso, fechar a janela encerra a Salinha.'
            }
            checked={closeToTray.enabled}
            onChange={toggleCloseToTray}
          />
        </div>
      )}
      {/* Overlay de jogo: só Windows (preload: process.platform, sandbox desligado). */}
      {hasOverlay && (
        <OverlaySettings />
      )}
      {!hasAutostart && !hasCloseToTray && !hasOverlay && (
        <p className="text-ds-md text-gray-400">Nada para configurar aqui nesta plataforma.</p>
      )}
      {/* Prévia da animação de nível: só no build de dev (some do build final). */}
      {import.meta.env.DEV && <LevelUpPreview />}
    </div>
  )
}
