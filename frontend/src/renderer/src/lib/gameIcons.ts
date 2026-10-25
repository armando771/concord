import {
  siCounterstrike,
  siDota2,
  siLeagueoflegends,
  siPubg,
  siRoblox,
  siRockstargames,
  siUbisoft,
  siValorant,
  type SimpleIcon
} from 'simple-icons'

// Logo por nome do jogo (gameCatalog). Jogo sem logo aqui cai no ícone de controle.
const GAME_ICONS: Readonly<Record<string, SimpleIcon>> = {
  VALORANT: siValorant,
  'League of Legends': siLeagueoflegends,
  'PUBG: BATTLEGROUNDS': siPubg,
  'Counter-Strike 2': siCounterstrike,
  Roblox: siRoblox,
  'Grand Theft Auto V': siRockstargames,
  'Dota 2': siDota2,
  'Rainbow Six Siege': siUbisoft
}

/** Caminho SVG (viewBox 24) do logo do jogo, ou undefined se não houver. */
export function gameIconPath(name: string): string | undefined {
  return GAME_ICONS[name]?.path
}
