/**
 * Faixa de participantes embaixo da transmissão em destaque. Só dá para ocultá-la
 * quando há uma live em destaque; sem live a grade normal aparece sempre.
 */
export function participantStripState(
  hasFeatured: boolean,
  hidden: boolean
): { toggleable: boolean; visible: boolean } {
  return { toggleable: hasFeatured, visible: !hasFeatured || !hidden }
}
