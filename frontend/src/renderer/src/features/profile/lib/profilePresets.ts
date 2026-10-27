import { DEFAULT_PROFILE_THEME, type ProfileTheme } from './profileTheme'

// Predefinições do editor de tema (Configurações → Perfis). Cada uma diz só
// o que foge do padrão; o resto (inclusive as opções finas) vem do padrão.

const preset = (theme: Partial<ProfileTheme>): ProfileTheme => ({
  ...DEFAULT_PROFILE_THEME,
  ...theme
})

export const PROFILE_PRESETS: { id: string; label: string; theme: ProfileTheme }[] = [
  { id: 'default', label: 'Padrão', theme: DEFAULT_PROFILE_THEME },
  {
    id: 'midnight',
    label: 'Meia-noite',
    theme: preset({
      border: 'neon',
      border_colors: ['#8b5cf6'],
      background: 'gradient',
      background_colors: ['#1e1b4b', '#0b1020'],
      effect: 'sparkles'
    })
  },
  {
    id: 'wine',
    label: 'Vinho',
    theme: preset({
      border: 'none',
      border_colors: [],
      background: 'gradient',
      background_colors: ['#6b1d12', '#4b4f58'],
      effect: 'none'
    })
  },
  {
    id: 'amethyst',
    label: 'Ametista',
    theme: preset({
      border: 'gradient',
      border_colors: ['#a78bfa', '#57534e'],
      background: 'gradient',
      background_colors: ['#2e1065', '#57534e'],
      effect: 'none'
    })
  },
  {
    id: 'sakura',
    label: 'Sakura',
    theme: preset({
      border: 'solid',
      border_colors: ['#ec4899'],
      background: 'gradient',
      background_colors: ['#fce7f3', '#f9a8d4'],
      effect: 'particles'
    })
  },
  {
    id: 'ocean',
    label: 'Oceano',
    theme: preset({
      border: 'gradient',
      border_colors: ['#22d3ee', '#3b82f6'],
      background: 'gradient',
      background_colors: ['#0c4a6e', '#082f49'],
      effect: 'none'
    })
  },
  {
    id: 'ember',
    label: 'Brasa',
    theme: preset({
      border: 'neon',
      border_colors: ['#f97316'],
      background: 'gradient',
      background_colors: ['#7f1d1d', '#1c0a05'],
      effect: 'particles'
    })
  },
  {
    id: 'snowy',
    label: 'Noite de neve',
    theme: preset({
      border: 'solid',
      border_colors: ['#94a3b8'],
      background: 'gradient',
      background_colors: ['#1e293b', '#0f172a'],
      effect: 'snow'
    })
  },
  {
    id: 'party',
    label: 'Festa',
    theme: preset({
      border: 'rainbow',
      border_colors: [],
      background: 'default',
      background_colors: [],
      effect: 'sparkles'
    })
  }
]
