import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCallStore } from '../../store/callStore'
import { PhoneIcon, PhoneOffIcon } from '../icons'
import Button from '../Button'
import Avatar from '../Avatar'
import StyledName from '../StyledName'

function useRingtone(ringing: boolean): void {
  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!ringing) return

    const playBurst = (): void => {
      const Ctor = window.AudioContext
      if (!Ctor) return
      if (!ctxRef.current) ctxRef.current = new Ctor()
      const ctx = ctxRef.current
      void ctx.resume()
      const now = ctx.currentTime
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = i === 0 ? 440 : 480
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 1)
      }
    }

    playBurst()
    timerRef.current = setInterval(playBurst, 2000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      void ctxRef.current?.close()
      ctxRef.current = null
    }
  }, [ringing])
}

function IncomingCallModal(): React.JSX.Element | null {
  const navigate = useNavigate()
  const status = useCallStore((s) => s.status)
  const peer = useCallStore((s) => s.participants[0] ?? null)
  const acceptCall = useCallStore((s) => s.acceptCall)
  const declineCall = useCallStore((s) => s.declineCall)

  useRingtone(status === 'ringing')

  if (status !== 'ringing' || !peer) return null

  const handleAccept = (): void => {
    void acceptCall().then(() => {
      // Estilo Discord: ao aceitar, abre a view de chamada na conversa.
      navigate(`/dm/${peer.id}`)
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl border border-white/10 bg-[#111320] shadow-2xl shadow-black/70 w-full max-w-sm p-8 text-center">
        <Avatar
          userId={peer.id}
          name={peer.display_name}
          avatarUrl={peer.avatar_url}
          size={80}
          animate="always"
          className="mx-auto mb-4"
        />
        <p className="text-lg font-bold text-white">
          <StyledName name={peer.display_name} userId={peer.id} style={peer.name_style} />
        </p>
        <p className="mb-6 text-xs text-gray-400">@{peer.username}</p>
        <p className="mb-6 animate-pulse text-sm font-semibold text-gray-300">Chamada de voz...</p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="danger" onClick={declineCall} aria-label="Recusar chamada">
            <PhoneOffIcon className="h-5 w-5" />
          </Button>
          <Button variant="success" onClick={handleAccept} aria-label="Aceitar chamada">
            <PhoneIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default IncomingCallModal
