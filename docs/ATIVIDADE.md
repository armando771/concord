# Em atividade (jogo em andamento)

Como no Discord: o jogo que a pessoa está jogando aparece embaixo do nome (lista
de membros, amigos, DMs, barra do usuário, painel de voz e perfil) e na coluna
**Atividade — N** da tela de Amigos.

> Não confundir com as **atividades de call** (jogos web como o Krunker, em
> `internal/call/activity.go`): aquilo é outra coisa.

## Fluxo

1. **Detecção (só Electron no Windows).** `frontend/src/main/gameDetector.ts`
   lista os processos (`tasklist`) a cada 15 s e procura executáveis do
   catálogo `frontend/src/shared/gameCatalog.ts`. Processo fora do catálogo
   nunca sai do PC. Para incluir um jogo, adicione uma entrada em `GAMES`.
   **Jogos da Steam fora do catálogo** (`main/steamGames.ts`): a Steam grava o
   appid do jogo aberto em `HKCU\Software\Valve\Steam\RunningAppID`; o título
   vem do `appmanifest_<appid>.acf` local (bibliotecas em `libraryfolders.vdf`).
   O catálogo tem prioridade; sem entrada, o jogo aparece com o nome da Steam.
2. **IPC.** `main/games.ts` liga/desliga o detector (`games:watch`) e avisa o
   renderer (`games:current`); exposto como `window.api.games`.
3. **Publicação.** `GameActivityBridge` + `presenceActivityStore` mandam
   `activity:set` / `activity:clear` pelo WebSocket (e de novo ao reconectar).
4. **Servidor.** `internal/websocket/activity.go` guarda só em memória (some
   quando a última conexão cai) e envia `presence:activity` para o próprio
   usuário, amigos e membros de servidores em comum, sem bloqueados
   (`SQLAudience`). Invisível esconde a atividade.
5. **Carga inicial.** `GET /api/presence/activities?ids=` devolve o que o
   usuário pode ver; usado junto de `fetchPresenceFor`.

## Privacidade

- Quem vê: amigos aceitos + servidores em comum, menos bloqueios.
- Opção em Configurações → Privacidade e segurança → Atividade (padrão: ligada).
- Limite no servidor: nome até 64 caracteres, tipo `game`, no máximo 1 troca por segundo.

## Fora do escopo (por enquanto)

Streaks/"faixas", ícones dos jogos, detecção no Linux/web e jogos fora do catálogo
que não sejam da Steam (Epic, GOG, etc.).
