import { useState } from 'react'
import { useModerationStore } from '../store/moderationStore'
import { useServerStore } from '../../servers/store/serverStore'
import { showToast } from '../../../shared/store/toastStore'
import { actionErrorMessage } from '../../servers/lib/permissionErrors'
import { charCount } from '../../profile/lib/profileValidation'
import { MAX_NICKNAME, normalizeNickname } from '../../servers/lib/serverNames'
import ConfirmModal from '../../friends/components/ConfirmModal'
import Modal from '../../../shared/ui/Modal'
import Button from '../../../shared/ui/Button'

const MAX_REASON = 512

/** Confirmações de expulsar e banir e o apelido, abertas de qualquer lugar do app. */
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
          <b className="text-strong">{kick?.name}</b> sai do servidor, mas pode voltar com um novo
          convite. Para impedir que volte, use <b>Banir</b>.
        </p>
      </ConfirmModal>
      <BanModal />
      <NicknameModal />
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
        <b className="text-strong">{ban.name}</b> sai do servidor e não consegue voltar, nem por
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

/**
 * "Alterar apelido": vale só neste servidor e não mexe no nome de exibição.
 * Vazio ou "Redefinir" tira o apelido.
 */
function NicknameModal(): React.JSX.Element | null {
  const target = useModerationStore((s) => s.nickname)
  const closeNickname = useModerationStore((s) => s.closeNickname)
  const changeNickname = useServerStore((s) => s.changeNickname)
  // Rascunho por pessoa: abrir para outra começa do apelido dela.
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!target) return null

  const key = `${target.serverId}:${target.userId}`
  const value = draft?.key === key ? draft.value : (target.nickname ?? '')
  const check = normalizeNickname(value)

  const close = (): void => {
    if (busy) return
    setDraft(null)
    closeNickname()
  }

  const save = async (raw: string): Promise<void> => {
    const result = normalizeNickname(raw)
    if (!result.ok) return
    setBusy(true)
    try {
      await changeNickname(target.serverId, target.userId, result.nickname ?? '')
      showToast.success(
        result.nickname
          ? target.self
            ? `Seu apelido agora é ${result.nickname}.`
            : `O apelido de ${target.displayName} agora é ${result.nickname}.`
          : target.self
            ? 'Seu apelido foi redefinido.'
            : `O apelido de ${target.displayName} foi redefinido.`
      )
      setDraft(null)
      closeNickname()
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Não foi possível alterar o apelido.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={target.self ? 'Alterar apelido' : `Alterar apelido de ${target.name}`}
      onClose={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save(value)
        }}
      >
        <label
          className="flex items-center justify-between text-ds-xs font-semibold text-gray-400"
          htmlFor="nickname-input"
        >
          <span>Apelido</span>
          <span className={check.ok ? 'text-gray-500' : 'text-danger'}>
            {charCount(value.trim())}/{MAX_NICKNAME}
          </span>
        </label>
        <input
          id="nickname-input"
          autoFocus
          value={value}
          onChange={(e) => setDraft({ key, value: e.target.value })}
          placeholder={target.displayName}
          aria-invalid={!check.ok}
          className="glass-input mt-1 w-full text-ds-sm"
        />
        {!check.ok && <p className="mt-1.5 text-ds-xs text-danger">{check.error}</p>}
        <p className="mt-2 text-ds-xs text-gray-400">
          {target.self ? 'Seu nome' : 'O nome'} só muda neste servidor, para todo mundo daqui. O
          nome de exibição e o @ continuam os mesmos.
        </p>
        <div className="mt-5 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void save('')}
            disabled={busy || !target.nickname}
            title="Tirar o apelido e voltar ao nome de exibição"
          >
            Redefinir
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !check.ok}>
              {busy ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default ModerationHost
