# 0002. Guardar o som de entrada no perfil e tocá-lo por um ouvinte do WS

- Status: aceito
- Data: 2026-10-26

## Contexto

Issue #255: cada pessoa escolhe um som que toca para quem já está na call
quando ela entra, no lugar do som sintetizado de "alguém entrou"
(`call/lib/sounds.ts`, `userJoin`). O usuário pediu que a escolha fique nas
configurações de **perfil** (onde ficam avatar e nome), não nas de voz.

Forças:

- O som é da pessoa, não de um servidor: vale em toda call de canal.
- Quem já está na call precisa saber o som **na hora** do `call:joined`, sem
  outra ida ao servidor (senão o aviso atrasa, e a maioria não tem som).
- Quem ouve decide: ensurdecido, pessoa silenciada ou mesa de áudio no zero
  não ouvem o clipe; sem som ou se o arquivo falhar, toca o padrão.
- Restrições do repo: nada de método novo em `call/service.go`, nada de campo
  em `callStore`/`chatStore`, e toda função tocada com CRAP ≤ 15. O
  `handleWsEvent` do `callStore` (um `switch` de ~30 casos) e o do `chatStore`
  estão muito acima de 15, então não podem ganhar uma linha.

## Opções consideradas

1. **Referenciar um som da mesa de áudio** (`soundboard_sounds.id` no usuário),
   como o Discord. Reaproveita o upload da mesa, mas os sons são por servidor e
   o arquivo só é servido a membros daquele servidor: numa call de outro
   servidor ninguém conseguiria ouvir. Resolver isso pede som por servidor ou
   regra nova de acesso ao arquivo. Mais complexo do que a issue pede.
2. **Tabela própria `user_entrance_sounds`** com o arquivo e a duração. Limpa,
   mas obriga a chamada a fazer outra consulta por entrada e não aproveita nada
   de `users`.
3. **Coluna `users.entrance_sound_url`, como `avatar_url`/`banner_url`** (o
   padrão do perfil): o arquivo vai para a pasta da mídia do perfil
   (`uploads/profile/entrance-sounds`), troca e remoção pelo mesmo `swapMedia`
   do avatar, servido sem token por um UUID que muda a cada upload. Como a
   chamada já monta o `UserInfo` a partir do usuário, o `call:joined` passa a
   levar `entrance_sound_url` de graça.

Para tocar no cliente:

- a. Trocar o `playSound('userJoin')` dentro do `handleWsEvent` do `callStore`:
  tocaria uma função com CRAP de milhares (regra 1).
- b. Ouvir as mudanças de `participants` do `callStore`: a lista também muda em
  resync e reconexão, o que tocaria som sem ninguém ter entrado.
- c. **Um ouvinte extra dos eventos do WS** (`onWsEvent` em `shared/api/ws.ts`,
  um observer de poucas linhas chamado depois do `onEvent` do cliente): o
  `call:joined` chega a um módulo próprio (`call/lib/entranceSound*.ts`) que
  decide entre o som da pessoa e o padrão. O `callStore` só perde a linha do
  som.

## Decisão

Opção 3 com o ouvinte c. Segue o padrão de mídia do perfil (coluna em
`users`, pasta do perfil, URL com UUID, cache imutável) e não engorda nenhum
god file: o `callStore` só perde uma linha e o `service.go` da chamada perde o
`userInfo`, que foi para `call/user_info.go`. O upload manda o próprio arquivo
no corpo (`POST /users/me/entrance-sound?duration_ms=N`), sem multipart: é um
arquivo só, pequeno, e assim o `request()` do app já cuida do token. Os limites
seguem a mesa de áudio (tipos pelo `media.Sniff`, duração medida pelo app),
mais curtos: até 5 s e 2 MB. O volume é o da mesa de áudio, como no Discord.

## Consequências

- O som de entrada vale em todos os servidores; não dá para escolher um por
  servidor. Se for preciso, um ADR novo pode adicionar a escolha por servidor.
- Não dá para usar um som que já está na mesa de áudio sem subir o arquivo de
  novo (a mesa é por servidor). Copiar da mesa para o perfil pode vir depois.
- `onWsEvent` serve a outros módulos que só reagem a um evento sem passar pelo
  despachante do `chatStore`. Ele não substitui o despachante: quem muda estado
  dos stores continua lá.
- O servidor confia na duração que o app declara (como na mesa); o cliente
  corta qualquer clipe em 5,5 s.

## Fontes

- [Discord: Soundboard FAQ (entrance sounds, volume da mesa)](https://support.discord.com/hc/articles/12612888127767)
- [Discord blog: como usar a Soundboard](https://discord.com/blog/how-to-use-the-discord-soundboard-add-more-sounds)
- Observer/pub-sub: o mesmo formato de `subscribe` que devolve o "desligar"
  usado pelo Zustand (`store.subscribe`) e pelo `EventTarget` do DOM.
