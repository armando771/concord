import { useState } from 'react'
import { useModerationStore } from '../store/moderationStore'
import { useServerStore } from '../store/serverStore'
import { showToast } from '../store/toastStore'
import { actionErrorMessage } from '../lib/permissionErrors'
import ConfirmModal from './friends/ConfirmModal'
import Modal from './Modal'
import Button from './Button'

const MAX_REASON = 512

/** Confirmações de expulsar e banir, abertas de qualquer lugar do app. */
function ModerationHost(): React.JSX.Element {
  const kick = useModerationStore((s) => s.kick)
  const closeKick = useModerationStore((s) => s.closeKick)
  const kickMember = useServerStore((s) => s.kickMember)

  return (
    <>
      <ConfirmModal
        open={kick !== null}
        title={`Expulsar ${kick?.name ?? ''}`}
        confirmLabel="Expulsar"
        onClose={closeKick}
        onConfirm={async () => {
          if (!kick) return
          try {
            await kickMember(kick.serverId, kick.userId)
            showToast.success(`${kick.name} foi expulso(a) do servidor.`)
          } catch (err) {
            showToast.error(actionErrorMessage(err, 'Não foi possível expulsar.'))
          }
        }}
      >
        <p>
          <b className="text-white">{kick?.name}</b> sai do servidor, mas pode voltar com um novo
          convite. Para impedir que volte, use <b>Banir</b>.
        </p>
      </ConfirmModal>
      <BanModal />
    </>
  )
}

function BanModal(): React.JSX.Element | null {
  const ban = useModerationStore((s) => s.ban)
  const closeBan = useModerationStore((s) => s.closeBan)
  const banMember = useServerStore((s) => s.banMember)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (!ban) return null

  const close = (): void => {
    if (busy) return
    setReason('')
    closeBan()
  }

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      await banMember(ban.serverId, ban.userId, reason.trim())
      showToast.success(`${ban.name} foi banido(a) do servidor.`)
      setReason('')
      closeBan()
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Não foi possível banir.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={`Banir ${ban.name}`} onClose={close}>
      <p className="text-sm leading-relaxed text-gray-300">
        <b className="text-white">{ban.name}</b> sai do servidor e não consegue voltar, nem por
        convite nem pelo código, até ser desbanido(a) em Configurações do servidor → Banimentos.
      </p>
      <label className="mt-4 block text-xs font-semibold text-gray-400" htmlFor="ban-reason">
        Motivo (opcional)
      </label>
      <textarea
        id="ban-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={MAX_REASON}
        rows={3}
        placeholder="Só quem gerencia o servidor vê o motivo."
        className="glass-input mt-1 w-full resize-none text-sm"
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Banindo...' : 'Banir'}
        </Button>
      </div>
    </Modal>
  )
}

export default ModerationHost
