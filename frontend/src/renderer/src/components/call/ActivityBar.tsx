import { useState } from 'react'
import { findActivity } from '../../../../shared/activities'
import { activityBanner } from '../../lib/activityState'
import { useActivityStore } from '../../store/activityStore'
import { useAuthStore } from '../../store/authStore'
import { showToast } from '../../store/toastStore'
import { ActivityGlyph } from './ActivityPickerPopover'

const pill =
  'cursor-pointer rounded-full px-3 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

/** Barra "Fulano abriu Krunker.io" + Entrar, em cima dos controles da chamada. */
function ActivityBar(): React.JSX.Element | null {
  const meId = useAuthStore((s) => s.user?.id ?? null)
  const callId = useActivityStore((s) => s.callId)
  const shared = useActivityStore((s) => s.shared)
  const local = useActivityStore((s) => s.local)
  const join = useActivityStore((s) => s.join)
  const stop = useActivityStore((s) => s.stop)
  const closeLocal = useActivityStore((s) => s.closeLocal)
  const shareLink = useActivityStore((s) => s.shareLink)
  const [editing, setEditing] = useState(false)
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)

  const banner = activityBanner({ callId, shared, local, pending: null }, meId)
  const activity = shared ? findActivity(shared.activityId) : undefined
  if (!banner || !activity || !shared) return null

  const submitLink = (): void => {
    const failure = shareLink(link)
    if (failure) {
      setError(failure)
      return
    }
    setEditing(false)
    setError(null)
    showToast.info('Link da sala compartilhado com a chamada.')
  }

  return (
    <div className="flex shrink-0 justify-center px-4 pb-2">
      <div
        role="status"
        className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#0b0c10]/95 px-3 py-2 shadow-lg"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/40"
          style={{ color: activity.accent }}
        >
          <ActivityGlyph activity={activity} className="h-4 w-4" />
        </span>
        <span className="min-w-0 truncate text-xs font-semibold text-gray-100">{banner.text}</span>
        {banner.hasLink && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-gray-300">
            sala compartilhada
          </span>
        )}

        {banner.mine && editing ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              submitLink()
            }}
          >
            <input
              type="url"
              inputMode="url"
              autoFocus
              value={link}
              onChange={(e) => {
                setLink(e.target.value)
                setError(null)
              }}
              placeholder="Cole o link da sala (opcional)"
              aria-label="Cole o link da sala (opcional)"
              aria-invalid={error !== null}
              title={error ?? activity.linkExample}
              className={`w-56 rounded-full border bg-black/40 px-3 py-1 text-[11px] text-white placeholder-gray-500 focus:outline-none ${
                error ? 'border-[#f23f43]' : 'border-white/10 focus:border-[#5865f2]'
              }`}
            />
            <button type="submit" className={`${pill} bg-[#5865f2] text-white hover:bg-[#4752c4]`}>
              Compartilhar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
              className={`${pill} bg-white/5 text-gray-300 hover:bg-white/10`}
            >
              Cancelar
            </button>
            {error && (
              <span role="alert" className="text-[11px] text-[#f23f43]">
                {error}
              </span>
            )}
          </form>
        ) : (
          <div className="flex items-center gap-1.5">
            {banner.joined ? (
              <button
                type="button"
                onClick={() => void join()}
                className={`${pill} bg-white/10 text-white hover:bg-white/15`}
              >
                Voltar ao jogo
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void join()}
                className={`${pill} bg-[#23a55a] text-white hover:bg-[#1e8c4a]`}
              >
                Entrar
              </button>
            )}
            {banner.mine && (
              <button
                type="button"
                onClick={() => {
                  setLink(shared.url)
                  setEditing(true)
                }}
                className={`${pill} bg-white/5 text-gray-200 hover:bg-white/10`}
              >
                {banner.hasLink ? 'Trocar link' : 'Compartilhar link'}
              </button>
            )}
            {banner.mine ? (
              <button
                type="button"
                onClick={stop}
                className={`${pill} bg-[#f23f43]/15 text-[#f23f43] hover:bg-[#f23f43]/25`}
              >
                Encerrar
              </button>
            ) : (
              banner.joined && (
                <button
                  type="button"
                  onClick={closeLocal}
                  className={`${pill} bg-white/5 text-gray-300 hover:bg-white/10`}
                >
                  Sair do jogo
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityBar
