import { useState } from 'react'
import { findActivity } from '../../../../../shared/activities'
import { activityBanner } from '../../activity/lib/activityState'
import { useActivityStore } from '../../activity/store/activityStore'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallNicknames } from '../../servers/hooks/useServerNames'
import { showToast } from '../../../shared/store/toastStore'
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

  const nicknames = useCallNicknames()
  const banner = activityBanner({ callId, shared, local, pending: null }, meId, nicknames)
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
        className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-subtle bg-secondary px-3 py-2 shadow-lg"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-input"
          style={{ color: activity.accent }}
        >
          <ActivityGlyph activity={activity} className="h-4 w-4" />
        </span>
        <span className="min-w-0 truncate text-xs font-semibold text-gray-100">{banner.text}</span>
        {banner.hasLink && (
          <span className="rounded bg-fg/10 px-1.5 py-0.5 text-[10px] font-semibold text-gray-300">
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
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
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
              className={`w-56 rounded-full border bg-input px-3 py-1 text-[11px] text-strong placeholder-gray-500 focus:outline-none ${
                error ? 'border-danger' : 'border-subtle focus:border-brand'
              }`}
            />
            <button type="submit" className={`${pill} bg-brand text-white hover:bg-brand-hover`}>
              Compartilhar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
              className={`${pill} bg-fg/5 text-gray-300 hover:bg-fg/10`}
            >
              Cancelar
            </button>
            {error && (
              <span role="alert" className="text-[11px] text-danger">
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
                className={`${pill} bg-fg/10 text-strong hover:bg-fg/15`}
              >
                Voltar ao jogo
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void join()}
                className={`${pill} bg-success-strong text-white hover:bg-success-strong-hover`}
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
                className={`${pill} bg-fg/5 text-gray-200 hover:bg-fg/10`}
              >
                {banner.hasLink ? 'Trocar link' : 'Compartilhar link'}
              </button>
            )}
            {banner.mine ? (
              <button
                type="button"
                onClick={stop}
                className={`${pill} bg-danger/15 text-danger hover:bg-danger/25`}
              >
                Encerrar
              </button>
            ) : (
              banner.joined && (
                <button
                  type="button"
                  onClick={closeLocal}
                  className={`${pill} bg-fg/5 text-gray-300 hover:bg-fg/10`}
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
