import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDuration } from '../lib/attachments'
import {
  recordElapsed,
  recordStep,
  type RecordEvent,
  type RecordState
} from '../lib/voiceRecord'
import { startVoiceRecording, type VoiceRecording } from '../lib/voiceRecorder'
import { showToast } from '../../../shared/store/toastStore'
import { MicIcon } from '../../../shared/ui/icons'

interface PendingRecording {
  starting: Promise<VoiceRecording>
  recording: VoiceRecording | null
  /** A ação final chegou antes do microfone abrir: cancelar quando abrir. */
  done: boolean
}

/**
 * Botão de microfone: segurar grava, soltar em cima envia, soltar fora
 * cancela. Enquanto grava, uma faixa cobre o campo de texto (o form precisa
 * ser `relative`).
 */
function VoiceRecordButton({
  disabled,
  onRecorded
}: {
  disabled?: boolean
  onRecorded: (blob: Blob, durationMs: number) => Promise<void>
}): React.JSX.Element {
  const [state, setState] = useState<RecordState>({ phase: 'idle' })
  const [now, setNow] = useState(0)
  const stateRef = useRef<RecordState>(state)
  const pending = useRef<PendingRecording | null>(null)
  const onRecordedRef = useRef(onRecorded)

  useEffect(() => {
    onRecordedRef.current = onRecorded
  }, [onRecorded])

  const abort = useCallback(() => {
    const p = pending.current
    pending.current = null
    if (!p) return
    p.done = true
    if (p.recording) p.recording.cancel()
  }, [])

  const dispatch = useCallback(
    (event: RecordEvent) => {
      const previous = stateRef.current
      const { state: next, action } = recordStep(previous, event)
      stateRef.current = next
      setState(next)

      if (action === 'start') {
        if ('at' in event) setNow(event.at)
        const p: PendingRecording = {
          starting: startVoiceRecording(),
          recording: null,
          done: false
        }
        pending.current = p
        p.starting.then(
          (recording) => {
            if (p.done) recording.cancel()
            else p.recording = recording
          },
          () => {
            if (pending.current === p) pending.current = null
            if (p.done) return
            p.done = true
            stateRef.current = { phase: 'idle' }
            setState({ phase: 'idle' })
            showToast.error('Não foi possível acessar o microfone.')
          }
        )
      } else if (action === 'send') {
        const p = pending.current
        pending.current = null
        if (!p) return
        p.done = true
        if (!p.recording) {
          // Soltou antes de o microfone abrir (ex.: primeira permissão): o
          // gravador é cancelado quando abrir.
          showToast.error('Não foi possível gravar. Segure de novo.')
          return
        }
        const at = 'at' in event ? event.at : Date.now()
        // Conta do início real da gravação, não do clique.
        const durationMs = Math.max(1, at - p.recording.startedAt)
        p.recording
          .stop()
          .then((blob) => onRecordedRef.current(blob, durationMs))
          .catch(() => {})
      } else if (action === 'cancel' || action === 'discard') {
        abort()
        if (action === 'discard') showToast.info('Segure o botão para gravar.')
      }
    },
    [abort]
  )

  const recording = state.phase === 'recording'

  useEffect(() => {
    if (!recording) return
    const release = (): void => dispatch({ type: 'release', at: Date.now() })
    // Saiu da janela segurando o botão: não dá para saber onde soltou.
    const blur = (): void => {
      dispatch({ type: 'leave' })
      dispatch({ type: 'release', at: Date.now() })
    }
    const timer = setInterval(() => {
      const at = Date.now()
      setNow(at)
      dispatch({ type: 'tick', at })
    }, 200)
    window.addEventListener('pointerup', release)
    window.addEventListener('blur', blur)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('blur', blur)
    }
  }, [recording, dispatch])

  // Sair da tela (ou trocar de sala) no meio da gravação descarta.
  useEffect(() => abort, [abort])

  const inside = state.phase === 'recording' && state.inside

  return (
    <>
      {recording && (
        <div
          className={`pointer-events-none absolute inset-0 z-[5] flex items-center gap-3 rounded-xl px-4 pr-16 text-sm ${
            inside ? 'bg-accent' : 'bg-red-600/90'
          }`}
        >
          {inside ? (
            <>
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
              <span className="shrink-0 font-semibold tabular-nums text-strong">
                {formatDuration(recordElapsed(state, now))}
              </span>
              <span className="truncate text-gray-400">
                Solte para enviar · arraste para fora para cancelar
              </span>
            </>
          ) : (
            <span className="font-semibold text-strong">Solte para cancelar</span>
          )}
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        title={disabled ? 'Enviando áudio...' : 'Segure para gravar áudio'}
        aria-label="Gravar áudio"
        onPointerDown={(e) => {
          if (e.button !== 0 || disabled) return
          // Sem setPointerCapture: o pointerleave precisa disparar ao sair.
          e.preventDefault()
          dispatch({ type: 'press', at: Date.now() })
        }}
        onPointerLeave={() => dispatch({ type: 'leave' })}
        onPointerEnter={() => dispatch({ type: 'enter' })}
        className={`relative z-10 shrink-0 cursor-pointer rounded-md p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          recording ? 'bg-red-500 text-white' : 'text-gray-400 hover:bg-fg/10 hover:text-strong'
        }`}
      >
        <MicIcon className="h-5 w-5" />
      </button>
    </>
  )
}

export default VoiceRecordButton
