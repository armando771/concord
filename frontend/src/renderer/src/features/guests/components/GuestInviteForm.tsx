import { useState } from 'react'
import Button from '../../../shared/ui/Button'
import Switch from '../../../shared/ui/Switch'
import { DURATION_OPTIONS, GUEST_COPY, type GuestDuration } from '../lib/guestCopy'
import type { GuestInvitesState } from '../hooks/useGuestInvites'

/** Duração e o que o visitante pode, e o botão de gerar. */
function GuestInviteForm({ state }: { state: GuestInvitesState }): React.JSX.Element {
  const [duration, setDuration] = useState<GuestDuration>('2h')
  const [canSpeak, setCanSpeak] = useState(true)
  const [canStream, setCanStream] = useState(false)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void state.create({ duration, can_speak: canSpeak, can_stream: canStream })
      }}
    >
      <fieldset>
        <legend className="mb-2 text-ds-sm font-medium text-gray-300">
          {GUEST_COPY.durationLabel}
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DURATION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex min-h-10 cursor-pointer items-center justify-center rounded-lg border px-2 text-ds-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-brand ${
                duration === opt.value
                  ? 'border-brand bg-brand/15 text-strong'
                  : 'border-subtle text-gray-300 hover:bg-fg/5'
              }`}
            >
              <input
                type="radio"
                name="guest-duration"
                value={opt.value}
                checked={duration === opt.value}
                onChange={() => setDuration(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-ds-sm font-medium text-gray-300">
          {GUEST_COPY.permsLabel}
        </legend>
        <div className="flex min-h-10 items-center justify-between gap-3">
          <span className="text-ds-sm text-strong">{GUEST_COPY.canSpeak}</span>
          <Switch checked={canSpeak} onChange={setCanSpeak} label={GUEST_COPY.canSpeak} />
        </div>
        <div className="flex min-h-10 items-center justify-between gap-3">
          <span className="text-ds-sm text-strong">{GUEST_COPY.canStream}</span>
          <Switch checked={canStream} onChange={setCanStream} label={GUEST_COPY.canStream} />
        </div>
      </fieldset>
      <Button type="submit" className="min-h-10 w-full" disabled={state.creating}>
        {state.creating ? GUEST_COPY.generating : GUEST_COPY.generate}
      </Button>
    </form>
  )
}

export default GuestInviteForm
