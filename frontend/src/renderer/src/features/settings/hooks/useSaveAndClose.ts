import { useState } from 'react'
import { showToast } from '../../../shared/store/toastStore'
import { saveErrorMessage } from '../lib/saveProfile'

/**
 * Modal de Minha conta que salva na hora: trava enquanto salva, fecha e avisa
 * com um toast; se falhar, fica aberto e mostra o erro.
 */
export function useSaveAndClose(
  onClose: () => void,
  success: string
): { busy: boolean; run: (save: () => Promise<void>) => Promise<void> } {
  const [busy, setBusy] = useState(false)
  const run = async (save: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try {
      await save()
      showToast.success(success)
      onClose()
    } catch (err) {
      showToast.error(saveErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}
