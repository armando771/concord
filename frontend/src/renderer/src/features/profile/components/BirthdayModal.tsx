import { useEffect, useState } from 'react'
import router from '../../../app/router'
import { getBirthdayToday, type BirthdayToday } from '../api/birthdays'
import { birthdayModalKey } from '../lib/birthday'
import { useAuthStore } from '../../auth/store/authStore'

const CONFETTI_COLORS = ['#f59e0b', '#ec4899', '#8b5cf6', '#22c55e', '#3b82f6', '#f43f5e']

function seen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markSeen(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Sem armazenamento: pode aparecer de novo ao reabrir o app hoje.
  }
}

/**
 * Feliz aniversário para quem faz aniversário hoje: aparece uma vez por dia,
 * na primeira vez que a pessoa abre o app, com os servidores que já mandaram
 * parabéns. Quem desligou "anunciar meu aniversário" não recebe.
 */
function BirthdayModal(): React.JSX.Element | null {
  const userId = useAuthStore((s) => s.user?.id)
  const [today, setToday] = useState<BirthdayToday | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getBirthdayToday()
      .then((result) => {
        if (cancelled || !result.is_birthday) return
        if (seen(birthdayModalKey(userId, result.date))) return
        setToday(result)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!today || !userId) return null

  const close = (): void => {
    markSeen(birthdayModalKey(userId, today.date))
    setToday(null)
  }

  const openServer = (serverId: string, channelId: string): void => {
    close()
    void router.navigate(`/servers/${serverId}/channels/${channelId}`)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-label="Feliz aniversário"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-amber-400/30 bg-floating p-6 text-center shadow-2xl"
      >
        {/* Confete caindo */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 24 }, (_, i) => (
            <span
              key={i}
              className="absolute top-0 h-2 w-1.5 rounded-sm"
              style={{
                left: `${(i * 37) % 100}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animation: `birthday-confetti ${2.4 + (i % 5) * 0.35}s linear ${(i % 8) * 0.25}s infinite`
              }}
            />
          ))}
        </div>

        <div className="relative">
          <div className="mx-auto mb-3 animate-bounce text-6xl" aria-hidden="true">
            🎂
          </div>
          <h2 className="text-xl font-bold text-strong">🎂 Feliz aniversário, {today.name}!</h2>
          {today.age !== undefined && today.age > 0 && (
            <p className="mt-1 text-base font-semibold text-amber-200">
              Hoje você completa {today.age} {today.age === 1 ? 'ano' : 'anos'}! 🎈
            </p>
          )}
          <p className="mt-2 text-sm text-gray-300">
            Hoje o dia é seu! Todo mundo dos seus servidores deseja muitas felicidades. 🎉
          </p>

          {today.servers.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {today.servers.map((g) => (
                <button
                  key={g.server_id}
                  type="button"
                  onClick={() => openServer(g.server_id, g.channel_id)}
                  className="cursor-pointer rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-400/20"
                >
                  {g.server_name}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={close}
            className="mt-5 w-full cursor-pointer rounded-lg bg-gradient-to-r from-amber-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
          >
            Obrigado! 🥳
          </button>
        </div>
      </div>
    </div>
  )
}

export default BirthdayModal
