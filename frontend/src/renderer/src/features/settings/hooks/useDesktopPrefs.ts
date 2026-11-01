import { useEffect, useState } from 'react'
import {
  desktopSections,
  type CloseToTrayState,
  type DesktopSections
} from '../lib/desktopSettings'

type Background = NonNullable<NonNullable<typeof window.api>['background']>

function useAutostart(background: Background | undefined): {
  autostart: boolean | null | undefined
  toggleAutostart: () => void
} {
  // undefined = ainda carregando; null = não suportado nesta plataforma
  const [autostart, setAutostart] = useState<boolean | null | undefined>(undefined)
  useEffect(() => {
    void background?.getAutostart().then(setAutostart)
  }, [background])
  const toggleAutostart = (): void => {
    void background?.setAutostart(!autostart).then((value) => {
      if (value !== null) setAutostart(value)
    })
  }
  return { autostart, toggleAutostart }
}

function useCloseToTray(background: Background | undefined): {
  closeToTray: CloseToTrayState | null | undefined
  toggleCloseToTray: () => void
} {
  const [closeToTray, setCloseToTray] = useState<CloseToTrayState | null | undefined>(undefined)
  useEffect(() => {
    void background?.getCloseToTray?.().then(setCloseToTray)
  }, [background])
  const toggleCloseToTray = (): void => {
    if (!closeToTray) return
    void background?.setCloseToTray(!closeToTray.enabled).then((value) => {
      if (value !== null) setCloseToTray({ ...closeToTray, enabled: value })
    })
  }
  return { closeToTray, toggleCloseToTray }
}

/** Estado e ações de Configurações → Aplicativo (iniciar com o sistema, bandeja, overlay). */
export function useDesktopPrefs(): ReturnType<typeof useAutostart> &
  ReturnType<typeof useCloseToTray> & { sections: DesktopSections } {
  const background = window.api?.background
  const auto = useAutostart(background)
  const tray = useCloseToTray(background)
  const sections = desktopSections({
    autostart: auto.autostart,
    closeToTray: tray.closeToTray,
    hasBackground: Boolean(background),
    overlaySupported: Boolean(window.api?.overlay?.supported)
  })
  return { ...auto, ...tray, sections }
}
