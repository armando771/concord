import ProfileCardFrame from '../../../../profile/components/ProfileCardFrame'
import { PROFILE_PRESETS } from '../../../../profile/lib/profilePresets'
import {
  profileThemeLook,
  sameTheme,
  type ProfileTheme
} from '../../../../profile/lib/profileTheme'
import { EFFECT_ICONS } from './effectIcons'

/**
 * Predefinições em grade densa de miniaturas (sem animar: o efeito aparece
 * como ícone no canto; a prévia grande mostra de verdade).
 */
export default function ThemePresets({
  value,
  onPick
}: {
  value: ProfileTheme
  onPick: (theme: ProfileTheme) => void
}): React.JSX.Element {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5"
      role="group"
      aria-label="Predefinições"
    >
      {PROFILE_PRESETS.map((preset) => {
        const active = sameTheme(preset.theme, value)
        const EffectIcon = preset.theme.effect === 'none' ? null : EFFECT_ICONS[preset.theme.effect]
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active}
            title={preset.label}
            onClick={() => onPick(preset.theme)}
            className={`min-w-0 cursor-pointer rounded-lg p-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              active ? 'bg-brand/15 ring-2 ring-brand' : 'hover:bg-fg/5'
            }`}
          >
            <ProfileCardFrame
              look={profileThemeLook(preset.theme)}
              aria-hidden="true"
              className="relative h-10 w-full"
            >
              {EffectIcon && (
                <EffectIcon
                  size={12}
                  className="absolute bottom-1 right-1 text-white drop-shadow-sm"
                />
              )}
            </ProfileCardFrame>
            <span className="mt-1 block truncate text-[11px] text-gray-300">{preset.label}</span>
          </button>
        )
      })}
    </div>
  )
}
