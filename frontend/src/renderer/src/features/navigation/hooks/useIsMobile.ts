import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { MOBILE_QUERY } from '../lib/mobileNav'

/** Tela de celular (abaixo de 768 px): uma coluna por vez. */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY)
}
