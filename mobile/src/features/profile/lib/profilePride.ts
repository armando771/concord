// Fundo "Arco-íris do orgulho": as seis faixas da bandeira pride, com uma
// camada escura por cima para o texto do cartão continuar legível.

/** Faixas da bandeira, de cima para baixo. */
export const PRIDE_STRIPES = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#24408e', '#732982']

/** A camada escura (#0a0a14) e quanto dela entra em cada faixa. */
const VEIL = [10, 10, 20]
const VEIL_AMOUNT = 0.55

function veiled(stripe: string): string {
  const n = parseInt(stripe.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const out = channels.map((v, i) => Math.round(v * (1 - VEIL_AMOUNT) + VEIL[i] * VEIL_AMOUNT))
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * As faixas já escurecidas: as cores reais do fundo (anel do avatar, contraste
 * do texto e dos cargos). A camada entra na própria cor para o fundo ser uma
 * imagem só, como o das bordas em degradê exigem.
 */
export const PRIDE_PALETTE = PRIDE_STRIPES.map(veiled)
