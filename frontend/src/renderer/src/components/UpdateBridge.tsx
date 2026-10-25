import { useEffect } from 'react'
import { playSound } from '../lib/sounds'
import { useUpdateStore } from '../store/updateStore'

/**
 * Liga os eventos de atualização do main ao `useUpdateStore` e toca o som
 * quando aparece uma versão nova. Montado uma vez no App: as sidebars
 * montam e desmontam, então o som não pode ficar na barra.
 */
function UpdateBridge(): null {
  const updates = window.api?.updates

  useEffect(() => {
    if (!updates) return
    const store = useUpdateStore.getState()
    let active = true
    // O estado que o main já tinha ao abrir entra como "já visto": sem som.
    void updates.status().then((s) => {
      if (active) store.seed(s)
    })
    const offAvailable = updates.onAvailable((version) => {
      // O main repete "disponível" a cada checagem: só a primeira vez toca.
      if (store.setAvailable(version)) playSound('update')
    })
    const offReady = updates.onReady(store.setReady)
    const offProgress = updates.onProgress(store.setProgress)
    const offError = updates.onError(store.setError)
    return () => {
      active = false
      offAvailable()
      offReady()
      offProgress()
      offError()
    }
  }, [updates])

  return null
}

export default UpdateBridge
