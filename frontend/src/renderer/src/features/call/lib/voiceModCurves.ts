// Voice mod: curvas dos WaveShapers (saturação e limitador) e o impulso do
// reverb. Puro (sem Web Audio): o grafo (voiceMod.ts) só copia os valores.

/** Pontos de cada curva de WaveShaper (ímpar: o zero cai num ponto exato). */
export const CURVE_SAMPLES = 1025

/** Curva com `f` aplicada a cada entrada x ∈ [−1, 1]. */
function curveOf(f: (x: number) => number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(CURVE_SAMPLES)
  for (let i = 0; i < CURVE_SAMPLES; i++) curve[i] = f((i / (CURVE_SAMPLES - 1)) * 2 - 1)
  return curve
}

const driveCurves = new Map<number, Float32Array<ArrayBuffer>>()

/**
 * Saturação suave: tanh(drive·x) normalizada para ±1 no fundo de escala.
 * Drive 0 = sem curva (o WaveShaper passa o sinal). Guardada por drive: trocar
 * de preset não recalcula.
 */
export function driveCurve(drive: number): Float32Array<ArrayBuffer> | null {
  if (drive <= 0) return null
  let curve = driveCurves.get(drive)
  if (!curve) {
    curve = curveOf((x) => Math.tanh(drive * x) / Math.tanh(drive))
    driveCurves.set(drive, curve)
  }
  return curve
}

/**
 * Limitador sem atraso (o DynamicsCompressor tem look-ahead, que desalinha o
 * seco e o processado): linear até `threshold`, depois curva até 1 sem passar.
 * A entrada chega dividida por `headroom`, para que picos de até `headroom`
 * vezes o fundo de escala também sejam domados.
 */
export function softLimitCurve(threshold: number, headroom: number): Float32Array<ArrayBuffer> {
  const knee = 1 - threshold
  return curveOf((u) => {
    const a = Math.abs(u * headroom)
    const y = a <= threshold ? a : threshold + knee * Math.tanh((a - threshold) / knee)
    return Math.sign(u) * y
  })
}

export interface ReverbImpulseOptions {
  /** Duração; o decaimento chega a −60 dB no fim. */
  seconds: number
  /** Silêncio antes das reflexões (sensação de distância das paredes). */
  preDelaySeconds: number
}

/**
 * Impulso de reverb sintetizado: ruído com decaimento exponencial, abafado por
 * um passa-baixas de um polo (paredes de pedra comem os agudos), com energia 1
 * (o nível do reverb é o próprio ganho do envio). Semente fixa: o mesmo impulso
 * em toda chamada.
 */
export function reverbImpulse(
  rate: number,
  { seconds, preDelaySeconds }: ReverbImpulseOptions,
  seed = 1
): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(Math.round(rate * seconds))
  const start = Math.round(rate * preDelaySeconds)
  // −60 dB (ln 1000 ≈ 6,9) ao fim da cauda.
  const decay = 6.9 / (samples.length - start)
  let state = seed >>> 0 || 1
  let smooth = 0
  let sum = 0
  for (let i = start; i < samples.length; i++) {
    // xorshift32: ruído barato e reproduzível.
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    const noise = (state >>> 0) / 0x8000_0000 - 1
    smooth += 0.5 * (noise - smooth)
    samples[i] = smooth * Math.exp(-decay * (i - start))
    sum += samples[i] * samples[i]
  }
  const scale = 1 / Math.sqrt(sum)
  for (let i = start; i < samples.length; i++) samples[i] *= scale
  return samples
}
