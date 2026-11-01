import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { joinServerByCode } from '../api/servers'
import { resendVerification } from '../../auth/api/auth'
import { getMe } from '../../profile/api/users'
import { inviteErrorMessage } from '../lib/invitePreview'
import { useAuthStore } from '../../auth/store/authStore'
import { useInviteLinkStore } from '../store/inviteLinkStore'
import { useServerStore } from '../store/serverStore'
import { showToast } from '../../../shared/store/toastStore'
import Avatar from '../../../shared/ui/Avatar'
import Button from '../../../shared/ui/Button'
import { InviteBackdrop, InviteServerIcon, InviteServerInfo } from './InviteServerInfo'
import { ButtonSkeleton, InvitePreviewSkeleton } from '../../../shared/ui/skeleton/layouts'
import { Skeleton } from '../../../shared/ui/skeleton/Skeleton'
import { useInvitePreview } from '../hooks/useInvitePreview'

/**
 * Confirmação do convite aberto por link (navegador ou salinha://), estilo
 * Discord: "Aceitar como <nome>" ou "Não, obrigado". Fica dentro do app
 * logado (AppShell).
 */
function InviteConfirmModal(): React.JSX.Element | null {
  const code = useInviteLinkStore((s) => s.code)
  if (!code) return null
  // key: outro link zera o estado (prévia, erro, entrando).
  return <InviteConfirm key={code} code={code} />
}

function InviteConfirm({ code }: { code: string }): React.JSX.Element {
  const navigate = useNavigate()
  const close = useInviteLinkStore((s) => s.close)
  const me = useAuthStore((s) => s.user)
  const servers = useServerStore((s) => s.servers)
  const fetchServers = useServerStore((s) => s.fetchServers)
  const state = useInvitePreview(code, true)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  // Banido: tentar de novo não adianta, então some o "Aceitar".
  const [banned, setBanned] = useState(false)
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const preview = state.status === 'ready' ? state.preview : null
  // is_member vem do servidor (logado); a lista local cobre o resto.
  const isMember = preview
    ? (preview.is_member ?? servers.some((s) => s.id === preview.server_id))
    : false
  const myName = me?.display_name || me?.username || 'você'
  // Entrar em servidor pede o e-mail confirmado (contas antigas não trazem o campo).
  const unverified = me?.email_verified === false

  /** Confirmou o e-mail em outra aba: relê a conta para liberar o "Aceitar". */
  const recheckEmail = async (): Promise<void> => {
    setChecking(true)
    setJoinError(null)
    setNotice(null)
    try {
      const fresh = await getMe()
      useAuthStore.getState().setUser(fresh)
      if (fresh.email_verified === false) setJoinError('Seu e-mail ainda não foi confirmado.')
    } catch (err) {
      setJoinError(inviteErrorMessage(err))
    } finally {
      setChecking(false)
    }
  }

  const resend = async (): Promise<void> => {
    setJoinError(null)
    try {
      const { sent } = await resendVerification()
      setNotice(
        sent ? `Enviamos um novo e-mail para ${me?.email}.` : 'Seu e-mail já está confirmado.'
      )
    } catch (err) {
      setJoinError(inviteErrorMessage(err))
    }
  }

  const openServer = (serverId: string): void => {
    close()
    navigate(`/servers/${serverId}`)
  }

  const accept = async (): Promise<void> => {
    setJoining(true)
    setJoinError(null)
    try {
      const server = await joinServerByCode(code)
      await fetchServers()
      showToast.success(`Você entrou em "${server.name}"!`)
      openServer(server.id)
    } catch (err) {
      setJoinError(inviteErrorMessage(err))
      const code = (err as { code?: unknown }).code
      setBanned(code === 'banned')
      // A conta em memória dizia confirmada, mas o servidor não: relê.
      if (code === 'email_not_verified')
        void getMe()
          .then((fresh) => useAuthStore.getState().setUser(fresh))
          .catch(() => {})
      setJoining(false)
    }
  }

  return createPortal(
    <div
      className="app-no-drag fixed inset-x-0 bottom-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      style={{ top: 'var(--titlebar-height, 0px)' }}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={preview ? `Convite para ${preview.name}` : 'Convite'}
        className="flex max-h-full w-full max-w-[880px] overflow-hidden rounded-2xl border border-subtle bg-modal shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-[420px] w-full flex-col items-center justify-center px-8 py-10 md:w-[420px] md:shrink-0">
          {state.status === 'loading' && (
            <div className="flex w-full flex-1 flex-col items-center">
              <div className="flex flex-1 flex-col justify-center">
                <InvitePreviewSkeleton />
              </div>
              <ButtonSkeleton className="mt-8" />
              <div className="mt-3 flex h-[18px] items-center">
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex flex-col items-center text-center">
              <InviteServerIcon name="?" />
              <h1 className="mt-4 text-ds-lg font-bold text-strong">Convite indisponível</h1>
              <p className="mt-2 text-ds-sm text-gray-300">{state.message}</p>
              <Button variant="secondary" className="mt-8 w-full" onClick={close}>
                Fechar
              </Button>
            </div>
          )}

          {preview && (
            <div className="flex w-full flex-1 flex-col items-center">
              <div className="flex flex-1 flex-col justify-center">
                <InviteServerInfo preview={preview} />
              </div>
              {joinError && (
                <p
                  role="alert"
                  className="mt-6 w-full rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-center text-ds-sm text-red-300"
                >
                  {joinError}
                </p>
              )}
              {notice && (
                <p className="mt-6 w-full text-center text-ds-sm text-emerald-300">{notice}</p>
              )}
              {banned ? (
                <Button variant="secondary" className="mt-6 w-full py-2.5" onClick={close}>
                  Fechar
                </Button>
              ) : unverified && !isMember ? (
                <>
                  <p className="mt-6 text-center text-ds-sm text-gray-200">
                    Confirme seu e-mail{me?.email ? ` (${me.email})` : ''} para entrar no servidor.
                    O link está no e-mail que enviamos.
                  </p>
                  <Button
                    className="mt-4 w-full py-2.5"
                    onClick={() => void recheckEmail()}
                    disabled={checking}
                  >
                    {checking ? 'Conferindo...' : 'Já confirmei'}
                  </Button>
                  <div className="mt-3 flex gap-4">
                    <button
                      type="button"
                      className="cursor-pointer text-ds-sm font-medium text-violet-300 hover:text-strong hover:underline"
                      onClick={() => void resend()}
                    >
                      Reenviar e-mail
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer text-ds-sm font-medium text-gray-300 hover:text-strong hover:underline"
                      onClick={close}
                    >
                      Não, obrigado
                    </button>
                  </div>
                </>
              ) : isMember ? (
                <>
                  <p className="mt-6 text-ds-sm font-medium text-gray-200">
                    Você já está neste servidor
                  </p>
                  <Button
                    className="mt-3 w-full py-2.5"
                    onClick={() => preview.server_id && openServer(preview.server_id)}
                  >
                    Abrir servidor
                  </Button>
                  <button
                    type="button"
                    className="mt-3 cursor-pointer text-ds-sm font-medium text-gray-300 hover:text-strong hover:underline"
                    onClick={close}
                  >
                    Fechar
                  </button>
                </>
              ) : (
                <>
                  <Button
                    className="mt-8 flex w-full items-center justify-center gap-2 py-2.5"
                    onClick={() => void accept()}
                    disabled={joining}
                  >
                    {me && (
                      <Avatar
                        userId={me.id}
                        name={myName}
                        avatarUrl={me.avatar_url}
                        size={20}
                        animate="never"
                      />
                    )}
                    <span className="truncate">
                      {joining ? 'Entrando...' : `Aceitar como ${myName}`}
                    </span>
                  </Button>
                  <button
                    type="button"
                    className="mt-3 cursor-pointer text-ds-sm font-medium text-gray-300 hover:text-strong hover:underline disabled:opacity-50"
                    onClick={close}
                    disabled={joining}
                  >
                    Não, obrigado
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Arte do servidor (o banner, no Discord): o ícone grande ou um degradê. */}
        <div className="relative hidden min-h-[420px] flex-1 md:block">
          <InviteBackdrop iconUrl={preview?.icon_url} className="absolute inset-0" />
          {preview && (
            <div className="absolute inset-0 flex items-center justify-center">
              <InviteServerIcon name={preview.name} iconUrl={preview.icon_url} size={160} />
            </div>
          )}
          {state.status === 'loading' && (
            <div aria-hidden className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="h-40 w-40 rounded-2xl" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default InviteConfirmModal
