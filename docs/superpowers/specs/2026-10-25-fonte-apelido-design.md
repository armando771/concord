# Estilo do nome de exibição (fonte + efeito)

## Objetivo
Permitir que cada pessoa escolha fonte e efeito do próprio nome de exibição,
como o Discord, e que o estilo apareça em todo lugar onde o nome é mostrado.

## Dados
Migração `000035_name_style` adiciona em `users`:
- `name_font TEXT NOT NULL DEFAULT 'default'`
- `name_effect TEXT NOT NULL DEFAULT 'solid'`
- `name_colors TEXT[] NOT NULL DEFAULT '{}'` (até 2 cores `#rrggbb`)

Quem já existe não muda. O backend valida contra listas fixas de IDs e cores
`#rrggbb` (mesmo padrão do `banner_color`); não aceita CSS livre. Entra em
`ProfileInput`, `ValidateProfile` e `UpdateProfile`.

## Propagação
As ~12 queries que hoje devolvem `display_name` (message, conversation,
friendship, server, call, user) passam a devolver também `name_style`
(`{font, effect, colors}`). Assim o estilo chega a mensagens, membros, DMs,
chamadas e perfil.

## Fontes (empacotadas offline via `@fontsource`)
As fontes do Discord são proprietárias; usamos equivalentes livres (OFL) no
mesmo estilo:
- Padrão, Tempo, Sakura, Jellybean, Modern, Medieval, 8Bit, Vampyre.
- Extras: manuscrita, slab, condensada, monoespaçada, display retrô.
- Cada família carrega só o peso necessário.

## Efeitos
Sólido, Degradê (2 cores), Neon, Toon, Pop (como no Discord) e extras
Arco-íris animado e Pulso. Só CSS (`background-clip:text`, `text-shadow`).
Respeita `prefers-reduced-motion`.

## Frontend
- `lib/nameStyle.ts`: catálogo de IDs, rótulos e CSS.
- Componente `<StyledName>` substitui o texto cru do nome nos pontos de uso.
- `ProfilesSection.tsx`: seletor de fonte e efeito, cores e prévia ao vivo.

## Testes
- Go: validação (ID inválido, cor inválida, padrão) e handler de perfil.
- Frontend: catálogo e render do `StyledName`.
- Paridade: os IDs do backend e do frontend precisam bater.

## Fora do escopo
Estilo por servidor; menções `@` dentro do texto da mensagem.
