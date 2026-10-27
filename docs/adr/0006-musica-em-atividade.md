# 0006. Detectar a música tocando pelas sessões de mídia do sistema, sem dependência nova

- Status: aceito
- Data: 2026-10-27

## Contexto

Pedido (#231): além de "Jogando X", mostrar "Ouvindo Spotify / YouTube Music..."
com a música, o artista e o tempo (barra tipo Spotify no Discord). Forças:

- a fonte tem que ser a do sistema, para pegar qualquer player (desktop e
  navegador), no Windows (principal) e no Linux; o web não detecta nada;
- sem dependência nova (go.mod, package.json, Cargo) e sem binário novo para
  compilar no Windows;
- custo baixo: nada de mandar ao servidor a cada segundo; quem vê calcula o
  tempo a partir do início e da duração;
- privacidade: só players conhecidos; vídeo comum no navegador não vira música;
- dá para jogar e ouvir ao mesmo tempo; apps antigos não podem quebrar.

## Opções consideradas

Windows (System Media Transport Controls, `GlobalSystemMediaTransportControlsSessionManager`):

1. **Estender o helper Rust (`concord-audio.exe`)** com a feature `Media_Control`
   da crate `windows`. Prós: leve (sem processo extra) e por eventos. Contras: o
   `.exe` é compilado e versionado à parte (`resources/win/`), não dá para
   compilar nem testar daqui, e mexe no `Cargo.toml`.
2. **PowerShell com WinRT** (`[...,ContentType=WindowsRuntime]` + `AsTask` por
   reflexão), num processo que fica aberto e escreve uma linha JSON a cada 2 s.
   Prós: nada para compilar, o repo já chama PowerShell (`screen/gameWindow.ts`),
   o parser é puro e testável no Linux. Contras: um `powershell.exe` aberto
   (~50–80 MB) enquanto a opção está ligada; a posição do SMTC só é atualizada
   de vez em quando (resolvido somando o tempo desde `LastUpdatedTime`).
3. **Addon nativo do Node** (ex.: pacotes de "now playing"): dependência nova e
   build nativo por plataforma. Descartado.

Linux (MPRIS no D-Bus da sessão):

1. **`busctl --user --json=short`** (systemd): saída em JSON, parser simples.
   Um `ListNames` + um `GetAll` por player a cada 3 s; o `Identity` fica em cache.
2. `gdbus`/`dbus-send`: mesma coisa, mas a saída é texto GVariant (parser frágil).
3. `playerctl`: nem sempre instalado.

Modelo no servidor:

1. **Lista de atividades** no lugar do campo único: mais genérico, mas muda o
   formato que apps antigos leem.
2. **Um slot por tipo** (jogo e música) no hub, com o mesmo `activity:set` /
   `activity:clear` (campo `kind`, sem ele = jogo) e o mesmo `presence:activity`,
   que ganha o campo `listening`. A carga inicial mantém o jogo nos campos de
   cima e a música em `listening`. Apps antigos seguem funcionando sem saber.

## Decisão

PowerShell + SMTC no Windows, `busctl` + MPRIS no Linux, e um slot por tipo no
hub (`activity_slot.go`). As duas fontes viram o mesmo `MediaSession`;
`mediaSessions.ts` filtra pelo catálogo (`shared/musicApps.ts`) e
`musicTracker.ts` decide quando mandar: na troca de faixa, na volta de uma
pausa ou num seek (no máximo um a cada 15 s para a mesma faixa); pausado ou
sem nada por 10 s limpa. O cliente manda a posição; o servidor calcula o início
pelo relógio dele. Sem capa do álbum: no SMTC ela vem como stream (caro) e, no
MPRIS, como URL externa (vazaria o IP de quem vê para terceiros).

## Consequências

- Sem nada novo no `package.json`/`go.mod`/`Cargo.toml`; o parser de cada
  plataforma é testado com saídas reais (fixtures em `main/activity/fixtures/`).
- Windows: um PowerShell aberto enquanto a opção está ligada; ele sai sozinho
  se o app sumir e o detector desiste depois de 3 quedas seguidas logo ao abrir
  (Windows sem SMTC). Se o custo incomodar, a opção 1 (helper Rust) continua
  disponível e só troca o `watchSmtc`.
- Linux sem systemd (sem `busctl`) não detecta nada.
- No Windows o Firefox se registra no SMTC com um AUMID que é um hash: não é
  reconhecido como navegador (Chrome/Edge/Brave são, quando há álbum).
- O relógio de quem vê pode diferir do servidor em alguns segundos: a barra
  pode ficar adiantada/atrasada nessa medida.
- Servidor antigo + app novo (só numa janela de deploy): `activity:clear` com
  `kind: "listening"` seria lido como "parei de jogar". O app só manda esse
  clear depois de ter mandado uma música.

## Fontes

- Microsoft, Windows.Media.Control: https://learn.microsoft.com/en-us/uwp/api/windows.media.control
- Raymond Chen, sessão de mídia atual pelo `GlobalSystemMediaTransportControlsSessionManager`: https://devblogs.microsoft.com/oldnewthing/20231108-00/?p=108980
- windows-rs, `GlobalSystemMediaTransportControlsSession`: https://microsoft.github.io/windows-docs-rs/doc/windows/Media/Control/struct.GlobalSystemMediaTransportControlsSession.html
- MPRIS 2, interface Player: https://specifications.freedesktop.org/mpris-spec/latest/Player_Interface.html
- mpris2 (Position em microssegundos, sem PropertiesChanged): https://mpris2.readthedocs.io/en/latest/mpris2.player.html
