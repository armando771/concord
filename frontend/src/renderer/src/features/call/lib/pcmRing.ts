// Buffer circular de PCM estéreo para o AudioWorklet do som da tela: recebe
// blocos intercalados [L,R,L,R…] do helper nativo e entrega canais separados.

export class PcmRing {
  private left: Float32Array
  private right: Float32Array
  private read = 0
  private size = 0

  /**
   * @param capacity quadros que cabem no buffer
   * @param maxLatency quadros de atraso tolerados; acima disso o mais antigo é
   *   descartado para o som não ir ficando atrasado em relação ao vídeo
   */
  constructor(
    capacity: number,
    private readonly maxLatency: number
  ) {
    this.left = new Float32Array(capacity)
    this.right = new Float32Array(capacity)
  }

  push(interleaved: Float32Array): void {
    const capacity = this.left.length
    for (let i = 0; i + 1 < interleaved.length; i += 2) {
      if (this.size === capacity) this.drop(1)
      const write = (this.read + this.size) % capacity
      this.left[write] = interleaved[i]
      this.right[write] = interleaved[i + 1]
      this.size++
    }
    if (this.size > this.maxLatency) this.drop(this.size - this.maxLatency)
  }

  pull(left: Float32Array, right: Float32Array): void {
    const capacity = this.left.length
    for (let i = 0; i < left.length; i++) {
      if (this.size === 0) {
        left[i] = 0
        right[i] = 0
        continue
      }
      left[i] = this.left[this.read]
      right[i] = this.right[this.read]
      this.read = (this.read + 1) % capacity
      this.size--
    }
  }

  private drop(frames: number): void {
    this.read = (this.read + frames) % this.left.length
    this.size -= frames
  }
}
