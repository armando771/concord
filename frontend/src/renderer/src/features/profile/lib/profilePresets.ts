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
  },
  // Com os efeitos em canvas e as opções finas.
  {
    id: 'inferno',
    label: 'Inferno',
    theme: preset({
      border: 'neon',
      border_colors: ['#ff5a1f'],
      border_animation: 'pulse',
      background: 'gradient',
      background_colors: ['#1c0a05', '#5c1208'],
      effect: 'fire',
      effect_density: 70
    })
  },
  {
    id: 'hacker',
    label: 'Hacker',
    theme: preset({
      border: 'solid',
      border_colors: ['#22c55e'],
      border_width: 1,
      background: 'solid',
      background_colors: ['#020a05'],
      texture: 'lines',
      effect: 'matrix'
    })
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    theme: preset({
      border: 'gradient',
      border_colors: ['#00f0ff', '#ff2bd6'],
      border_animation: 'spin',
      border_width: 3,
      background: 'gradient',
      background_colors: ['#140a2e', '#0a0612'],
      background_angle: 135,
      texture: 'grid',
      effect: 'glitch'
    })
  },
  {
    id: 'storm',
    label: 'Tempestade',
    theme: preset({
      border: 'solid',
      border_colors: ['#64748b'],
      background: 'gradient',
      background_colors: ['#0f172a', '#334155'],
      background_angle: 360,
      texture: 'grain',
      effect: 'storm'
    })
  },
  {
    id: 'blackhole',
    label: 'Buraco negro',
    theme: preset({
      border: 'neon',
      border_colors: ['#a78bfa'],
      background: 'gradient',
      background_colors: ['#05010f', '#1e1145'],
      effect: 'galaxy',
      effect_speed: 65
    })
  },
  {
    id: 'aurora',
    label: 'Aurora boreal',
    theme: preset({
      border: 'gradient',
      border_colors: ['#34d399', '#818cf8'],
      background: 'gradient',
      background_colors: ['#03141c', '#0b1f3a'],
      effect: 'aurora'
    })
  },
  {
    id: 'passion',
    label: 'Paixão',
    theme: preset({
      border: 'neon',
      border_colors: ['#ff4d8d'],
      border_animation: 'pulse',
      background: 'gradient',
      background_colors: ['#fde2ec', '#f9a8c9'],
      texture: 'dots',
      effect: 'hearts'
    })
  },
  {
    id: 'birthday',
    label: 'Aniversário',
    theme: preset({
      border: 'rainbow',
      border_width: 3,
      background: 'gradient',
      background_colors: ['#1e1b4b', '#312e81'],
      background_angle: 45,
      effect: 'confetti'
    })
  },
  {
    id: 'pride',
    label: 'Pride',
    theme: preset({
      border: 'rainbow',
      border_width: 3,
      background: 'pride',
      effect: 'confetti'
    })
  },
  {
    id: 'outrun',
    label: 'Outrun',
    theme: preset({
      border: 'gradient',
      border_colors: ['#ff2bd6', '#ffb84d'],
      background: 'gradient',
      background_colors: ['#1a0533', '#3b0a45'],
      effect: 'synthwave'
    })
  },
  {
    id: 'rainy',
    label: 'Dia chuvoso',
    theme: preset({
      border: 'solid',
      border_colors: ['#7cc4ff'],
      border_animation: 'static',
      background: 'gradient',
      background_colors: ['#1e293b', '#0f2741'],
      texture: 'grain',
      effect: 'rain'
    })
  }
]
