// Contrato dos efeitos desenhados em <canvas> no cartão de perfil (Fogo,
// Matrix, Glitch...). Cada efeito é uma "cena": estado simples + passo (só
// matemática, testável) + desenho num contexto 2D. Quem roda o laço e decide
// quando pausar é loop.ts / EffectCanvas.tsx.

/** Gerador de números pseudoaleatórios em [0, 1). */
export type Rand = () => number

/** Parâmetros já resolvidos a partir do tema (lib/profileTheme.ts → effectParams). */
export interface EffectParams {
  /** Fator de quantidade: 1 = padrão; vai de ~0,4 a ~2,7. */
  density: number
  /** Fator de velocidade: 1 = padrão; vai de ~0,4 a ~2,4 (o laço já multiplica o dt). */
  speed: number
  /** Cor principal do efeito (#rrggbb, já validada). */
  color: string
}

/** O pedaço do CanvasRenderingContext2D que as cenas usam. */
export type Ctx = Pick<
  CanvasRenderingContext2D,
  | 'clearRect'
  | 'fillRect'
  | 'strokeRect'
  | 'beginPath'
  | 'closePath'
  | 'moveTo'
  | 'lineTo'
  | 'arc'
  | 'ellipse'
  | 'quadraticCurveTo'
  | 'bezierCurveTo'
  | 'fill'
  | 'stroke'
  | 'fillText'
  | 'save'
  | 'restore'
  | 'translate'
  | 'rotate'
  | 'scale'
  | 'createLinearGradient'
  | 'createRadialGradient'
  | 'fillStyle'
  | 'strokeStyle'
  | 'globalAlpha'
  | 'globalCompositeOperation'
  | 'lineWidth'
  | 'lineCap'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'shadowBlur'
  | 'shadowColor'
>

export interface Scene<S = unknown> {
  /** Estado inicial para um cartão de w×h px (CSS, não do dispositivo). */
  init(w: number, h: number, p: EffectParams, rand: Rand): S
  /** Avança dt segundos (já com a velocidade aplicada; dt ≤ 0,1). */
  step(s: S, dt: number, rand: Rand): void
  /** Desenha o quadro atual (o canvas já foi limpo). */
  draw(ctx: Ctx, s: S): void
}
