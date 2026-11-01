import { useEffect } from 'react'
import '../assets/background.css'
import { parseWindowActivity } from '../../../shared/windowActivity'
import { holdLoops } from '../shared/lib/perf/loopPauser'
import { useInBackground, useWindowActivityStore } from '../shared/store/windowActivityStore'

/** No app web quem diz o foco e a visibilidade é o próprio navegador. */
function readBrowserActivity(): void {
  const visible = document.visibilityState === 'visible'
  useWindowActivityStore.getState().setActivity({ visible, focused: visible && document.hasFocus() })
}

function listenBrowser(): () => void {
  readBrowserActivity()
  window.addEventListener('focus', readBrowserActivity)
  window.addEventListener('blur', readBrowserActivity)
  document.addEventListener('visibilitychange', readBrowserActivity)
  return () => {
    window.removeEventListener('focus', readBrowserActivity)
    window.removeEventListener('blur', readBrowserActivity)
    document.removeEventListener('visibilitychange', readBrowserActivity)
  }
}

/**
 * Segundo plano (janela sem foco, minimizada ou na bandeja): guarda o estado no
 * store, pausa as animações CSS infinitas e corta as transições até a pessoa
 * voltar ao app.
 */
function WindowActivityBridge(): null {
  const background = useInBackground()

  useEffect(() => {
    const api = window.api?.windowActivity
    if (!api) return listenBrowser()
    return api.onChange((raw) => {
      const activity = parseWindowActivity(raw)
      if (activity) useWindowActivityStore.getState().setActivity(activity)
    })
  }, [])

  useEffect(() => {
    // assets/background.css corta as transições com este atributo.
    document.documentElement.toggleAttribute('data-app-background', background)
    if (!background) return
    return holdLoops(() => document.getAnimations())
  }, [background])

  return null
}

export default WindowActivityBridge
