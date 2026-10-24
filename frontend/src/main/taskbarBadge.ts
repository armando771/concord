// Aviso na barra de tarefas do Windows (estilo Discord): piscar o botão e
// mostrar um selo vermelho com o número de mensagens não vistas. Regras e
// desenho do selo são puros para poder testar; o Electron só aplica.

export interface TaskbarRequest {
  /** Chamada recebida: sempre pisca, como antes. */
  urgent?: boolean
  /** Preferência "Mostrar na barra de tarefas" (padrão: ligada). */
  taskbar?: boolean
}

/** O que fazer na barra de tarefas para uma notificação que vai aparecer. */
export function taskbarAction(request: TaskbarRequest): { flash: boolean; badge: boolean } {
  if (request.urgent) return { flash: true, badge: false }
  const enabled = request.taskbar !== false
  return { flash: enabled, badge: enabled }
}

/** Texto do selo: nada sem pendências, até 9 o número, depois "9+". */
export function badgeLabel(count: number): string | null {
  if (count <= 0) return null
  return count > 9 ? '9+' : String(count)
}

// Fonte 3x5 só com o que o selo usa ('#' = aceso).
const GLYPHS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...']
}

const RED = [0x45, 0x42, 0xf2] // #f23f42 em BGR (vermelho do Discord)

/**
 * Selo redondo vermelho com o número em branco, em BGRA (formato de
 * `nativeImage.createFromBitmap`). `size` deve ser múltiplo de 16.
 */
export function badgeBitmap(label: string, size = 32): Buffer {
  const pixels = Buffer.alloc(size * size * 4)
  const radius = size / 2
  const set = (x: number, y: number, b: number, g: number, r: number, a: number): void => {
    const i = (y * size + x) * 4
    pixels[i] = b
    pixels[i + 1] = g
    pixels[i + 2] = r
    pixels[i + 3] = a
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x + 0.5 - radius, y + 0.5 - radius)
      // borda suavizada em 1px para não serrilhar
      const alpha = Math.max(0, Math.min(1, radius - dist))
      if (alpha > 0) set(x, y, RED[0], RED[1], RED[2], Math.round(alpha * 255))
    }
  }

  const chars = [...label].filter((c) => GLYPHS[c])
  if (chars.length === 0) return pixels
  const scale = size / 16
  const width = (chars.length * 4 - 1) * scale
  const left = Math.floor((size - width) / 2)
  const top = Math.floor((size - 5 * scale) / 2)
  chars.forEach((char, n) => {
    GLYPHS[char].forEach((row, gy) => {
      ;[...row].forEach((cell, gx) => {
        if (cell !== '#') return
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            set(left + (n * 4 + gx) * scale + dx, top + gy * scale + dy, 255, 255, 255, 255)
          }
        }
      })
    })
  })
  return pixels
}

/** Descrição acessível do selo (leitor de tela da barra de tarefas). */
export function badgeDescription(count: number): string {
  return count === 1 ? '1 notificação não lida' : `${count} notificações não lidas`
}
