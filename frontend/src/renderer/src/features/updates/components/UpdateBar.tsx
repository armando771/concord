import { useCallStore } from '../../call/store/callStore'
import { useUpdateStore } from '../store/updateStore'
import Button from '../../../shared/ui/Button'

interface UpdateBarViewProps {
  version: string
  ready: boolean
  requested: boolean
  progress: number
  error: string | null
  confirming: boolean
  inCall: boolean
  callType: 'channel' | 'dm' | null
  onInstall(): void
  onConfirm(): void
  onCancel(): void
}

function message(p: UpdateBarViewProps): string {
  if (p.error) return p.error
  if (p.requested) {
    return p.ready || p.progress >= 100
      ? `Reiniciando para instalar a versão ${p.version}…`
      : `Baixando a versão ${p.version}… ${p.progress}%`
  }
  if (p.confirming) {
    return p.callType === 'channel'
      ? 'A chamada será interrompida ao reiniciar. Você voltará automaticamente ao canal.'
      : 'Atualizar agora vai te tirar da chamada. A Salinha reinicia em seguida.'
  }
  // Baixando sozinho em segundo plano: o botão continua (instala ao terminar).
  if (!p.ready && p.progress > 0) return `Baixando a versão ${p.version}… ${p.progress}%`
  return `Versão ${p.version} disponível`
}

export function UpdateBarView(p: UpdateBarViewProps): React.JSX.Element {
  return (
    <div role="status" className="shrink-0 border-t border-success/40 bg-success/10 px-3 py-2">
      <p className="line-clamp-3 break-words text-xs text-gray-200" title={message(p)}>
        {message(p)}
      </p>
      {p.requested && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-fg/10">
          <div className="h-full bg-success" style={{ width: `${p.ready ? 100 : p.progress}%` }} />
        </div>
      )}
      {!p.requested && (
        <div className="mt-2 flex justify-end gap-2">
          {p.confirming && (
            <Button variant="ghost" className="px-3 py-1 text-xs" onClick={p.onCancel}>
              Cancelar
            </Button>
          )}
          <Button
            variant="success"
            className="px-3 py-1 text-xs"
            onClick={p.inCall && !p.confirming ? p.onConfirm : p.onInstall}
          >
            {p.confirming ? 'Atualizar mesmo assim' : 'Atualizar'}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Barra "Versão X disponível" acima do painel "Voz conectada". Fica visível
 * enquanto houver versão nova — não some com um "Depois". O main baixa sozinho:
 * enquanto baixa mostra o progresso; pronta, o Atualizar instala na hora.
 */
function UpdateBar(): React.JSX.Element | null {
  const version = useUpdateStore((s) => s.version)
  const readyVersion = useUpdateStore((s) => s.readyVersion)
  const requested = useUpdateStore((s) => s.requested)
  const progress = useUpdateStore((s) => s.progress)
  const error = useUpdateStore((s) => s.error)
  const confirming = useUpdateStore((s) => s.confirming)
  const install = useUpdateStore((s) => s.install)
  const setConfirming = useUpdateStore((s) => s.setConfirming)
  const inCall = useCallStore((s) => s.status !== 'idle')
  const callType = useCallStore((s) => s.type)

  if (!version) return null

  return (
    <UpdateBarView
      version={version}
      ready={readyVersion === version}
      requested={requested}
      progress={progress}
      error={error}
      confirming={confirming && inCall}
      inCall={inCall}
      callType={callType}
      onInstall={install}
      onConfirm={() => setConfirming(true)}
      onCancel={() => setConfirming(false)}
    />
  )
}

export default UpdateBar
