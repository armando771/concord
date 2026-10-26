import { startWatchingStream, useStreamJoinStore } from '../features/call/store/streamJoinStore'
import ConfirmModal from '../features/friends/components/ConfirmModal'

/** Confirmação de sair da chamada atual para assistir a transmissão de alguém. */
function StreamJoinHost(): React.JSX.Element {
  const pending = useStreamJoinStore((s) => s.pending)
  const close = useStreamJoinStore((s) => s.close)

  return (
    <ConfirmModal
      open={pending !== null}
      title="Sair da chamada atual?"
      confirmLabel="Entrar na transmissão"
      danger={false}
      onClose={close}
      onConfirm={() => {
        // Não espera a tela aparecer: o modal fecha e a call abre.
        if (pending) void startWatchingStream(pending)
      }}
    >
      <p>
        Para assistir à transmissão de <b className="text-strong">{pending?.name}</b>, você sai da
        chamada em que está
        {pending?.channelName ? (
          <>
            {' '}
            e entra em <b className="text-strong">{pending.channelName}</b>
          </>
        ) : null}
        .
      </p>
    </ConfirmModal>
  )
}

export default StreamJoinHost
