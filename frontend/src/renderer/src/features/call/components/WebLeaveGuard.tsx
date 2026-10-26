import { useEffect } from 'react'
import { useCallStore } from '../store/callStore'
import { shouldConfirmLeave } from '../lib/leaveGuard'

/** Build web: confirma antes de fechar/recarregar a aba no meio de uma chamada. */
function WebLeaveGuard(): null {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!shouldConfirmLeave(useCallStore.getState().status)) return
      event.preventDefault()
      // Navegadores mais antigos só perguntam com returnValue preenchido.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  return null
}

export default WebLeaveGuard
