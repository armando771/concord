# Overlay de jogo nativo (Windows)

Decisão em [ADR 0004](adr/0004-overlay-nativo.md). No Windows o overlay de jogo
é desenhado pelo helper (`concord-audio.exe overlay`), numa janela Win32 em
camada com Direct2D, em vez de uma janela do Electron. Linux e macOS continuam
com a janela do Electron, que também é o plano B no Windows.

## Quem faz o quê

| Parte | Onde |
|---|---|
| Estado da call → snapshot (inclui as cores do tema) | `renderer/src/features/overlay/components/OverlayBridge.tsx`, `lib/overlayState.ts`, `lib/overlayTheme.ts` |
| Controlador (jogo na frente, atalhos, qual janela usar) | `main/overlay/overlay.ts`, `overlayRenderer.ts` |
| Janela do Electron | `main/overlay/electronOverlay.ts` + `renderer/src/overlay/` |
| Janela nativa: processo, protocolo, avatares | `main/overlay/nativeOverlay.ts`, `nativeOverlayProtocol.ts`, `overlayAvatars.ts`, `nativeHelper.ts` |
| Helper: protocolo, geometria, GIF, ícones, estados (puros) | `native/concord-audio/src/overlay/{protocol,json,layout,gif,icons,controller}.rs` |
| Helper: janela, desenho, imagens (Win32) | `native/concord-audio/src/overlay/win/{mod,app,render,images}.rs` |

## Qual janela é usada

1. Fora do Windows: Electron.
2. `--overlay=electron` no atalho do app ou `SALINHA_OVERLAY=electron` no
   ambiente: Electron (para comparar). `native` é o padrão.
3. `concord-audio.exe` ausente: Electron.
4. O helper não disse `ready` em 5 s, não iniciou ou saiu: Electron até reabrir
   o app. Fica no log (`%APPDATA%\Concord\logs\audio.log`):
   `overlay: janela nativa falhou (...); usando a do Electron`.

O helper sobe quando a call começa (com o overlay ligado) e fecha quando ela
acaba; com o jogo fora da frente a janela fica escondida e a thread parada.

## Protocolo

Uma mensagem JSON por linha, UTF-8, `\n` no fim (`\r\n` também é aceito).
Campo desconhecido é ignorado; mensagem com `type` desconhecido também.

### Salinha → helper (stdin)

Só quando muda (o main corta linhas repetidas). Escondido:

```json
{"type":"state","visible":false}
```

À vista:

```json
{
  "type": "state",
  "visible": true,
  "editing": false,
  "game": 4242,
  "monitor": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
  "opacity": 30,
  "layout": { "position": { "x": 0.01, "y": 0.4 }, "scale": 1 },
  "hint": "",
  "theme": { "floating": "#252429", "strong": "#fbfbfb", "normal": "#efeff1", "muted": "#96979e",
             "brand": "#5865f2", "speaking": "#45a366", "danger": "#ff6467" },
  "members": [
    { "id": "u1", "name": "Ana", "initial": "A", "avatar": "C:\\...\\9f3c...", "animated": true,
      "tag": "VOCÊ", "muted": false, "deafened": false, "speaking": true, "watching": false }
  ],
  "more": 0,
  "viewers": null
}
```

| Campo | Significado |
|---|---|
| `game` | pid do jogo na frente: mudou, a janela sobe no z-order de novo |
| `monitor` | monitor do jogo em pixels físicos (o que o modo `foreground` informou); o helper acha a área de trabalho e o DPI dele |
| `opacity` | opacidade das pílulas em repouso, 10–60 (%); quem fala ganha +40, até 85 |
| `layout.position` | canto da lista em fração da área de trabalho; `null` = borda esquerda, no meio |
| `layout.scale` | 0,7–1,6 em passos de 0,05 |
| `hint` | texto da dica do modo de edição (só editando) |
| `theme` | cores do tema em vigor; faltou alguma, vale a do tema escuro padrão |
| `members[].avatar` | arquivo local baixado pelo main; `null` = mostra a inicial |
| `members[].animated` | o arquivo é GIF animado: anima só enquanto `speaking`, senão fica no 1º quadro |
| `members[].tag` | etiqueta depois do nome (`VOCÊ` no próprio usuário) |
| `members[].watching` | assiste à live de quem usa o overlay: olho verde depois dos ícones de mudo |
| `viewers` | espectadores da live de quem usa o overlay (selo "olho + número" no fim da lista); `null` = sem live ou opção desligada, `0` = live sem ninguém |
| `more` | quantos não couberam (pílula "+N"); `members` vem com no máximo 8 |

Valores fora do lugar são encaixados nos limites pelos dois lados.

### Helper → Salinha (stdout)

```json
{"type":"ready"}
{"type":"layout","layout":{"position":{"x":0.5,"y":0.25},"scale":1.1}}
{"type":"error","message":"avatar C:\\...: WIC ..."}
```

- `ready`: janela criada; só depois disso o atalho liga a edição.
- `layout`: fim de um arraste na edição; o main repassa ao renderer principal,
  que salva nas preferências e devolve no próximo `state`. Até lá o helper
  continua mostrando onde o arraste parou.
- `error`: vai para o log; não derruba nada.
- stderr: texto livre, também para o log. stdin fechado = o helper sai.

Testes do contrato: `frontend/src/main/overlay/nativeOverlayProtocol.test.ts`
(serialização) e `cargo test` em `native/concord-audio` (parsing, geometria,
GIF, estados).

## Paridade com a janela do Electron

Igual: lista de quem está na call (até 8 pílulas + "+N"), avatar redondo
(foto, ou inicial sobre a cor da marca), GIF animado só para quem fala, anel
verde e nome em negrito de quem fala, pílula mais opaca para quem fala,
"VOCÊ", ícones de microfone/fone cortados, cores do tema escolhido, opacidade
das configurações, posição/escala salvas, posição padrão, modo de edição pelo
atalho configurado (moldura tracejada, arrastar, canto de redimensionar, dica,
Esc), só com jogo em tela cheia em janela na frente, some com a Salinha na
frente, click-through, sem foco, fora da captura de tela, DPI por monitor.

Diferente: fonte Segoe UI no lugar da Outfit; sem a transição de 150 ms na
opacidade; na edição a janela fica do tamanho da lista (o arraste usa captura
do mouse), então clicar fora da lista vai para o jogo; nome de cor/estilo do
perfil não existe em nenhum dos dois overlays hoje.

## Roteiro de teste no Windows

### Gerar o build

No Linux (Docker):

```bash
scripts/build-win.sh http://SEU-ENDERECO:PORTA
# saída: frontend/dist/Salinha-<versão>-portable.exe (e o setup)
```

O script já compila o `concord-audio.exe` (com o modo `overlay`) e embute no app.

### Ligar e desligar

- Padrão: janela nativa. Confira no `%APPDATA%\Concord\logs\audio.log`:
  `overlay: usando a janela nativa` e `overlay: janela nativa pronta`.
- Janela antiga, para comparar: feche a Salinha pela bandeja (é instância única)
  e abra pelo PowerShell:

  ```powershell
  $env:SALINHA_OVERLAY = 'electron'; & .\Salinha-<versão>-portable.exe
  ```

  (ou `--overlay=electron` no destino de um atalho). No log não aparece
  "janela nativa".

### O que conferir na tela

Jogo em tela cheia em janela (borderless), em call com pelo menos 2 pessoas,
uma com avatar GIF:

1. Lista na borda esquerda, no meio; pílulas com avatar, nome, "VOCÊ".
2. Falar: anel verde, nome em negrito, pílula mais forte; o GIF só anima
   enquanto a pessoa fala e volta ao 1º quadro ao parar.
3. Mudo e ensurdecido: ícones vermelhos de microfone e fone cortados.
4. Mais de 8 pessoas: pílula "+N".
5. Configurações → opacidade e tema: a lista acompanha.
6. Shift+Tab (ou o atalho configurado): moldura tracejada e dica; arrastar move,
   o canto redimensiona; Esc sai; a posição fica salva (reabra o jogo/app);
   "Restaurar posição" volta ao padrão.
7. Clicar no jogo com o overlay por cima: o clique vai para o jogo; o jogo não
   perde o foco nem na edição.
8. Alt+Tab para a Salinha: a lista some; voltar ao jogo: aparece.
9. Monitor secundário e escala 125%/150%: tamanho e posição certos.
10. Compartilhar a tela do jogo: quem assiste não vê o overlay.
11. Nomes com acento e emoji, nome bem comprido (termina em "…").

### Medir antes/depois

Mesma cena do jogo, parado no mesmo lugar, 60 s cada, 3 vezes por cenário:
A) Salinha fechada; B) em call com `SALINHA_OVERLAY=electron`; C) em call com o
nativo. Alguém falando de vez em quando (com avatar GIF).

- FPS do jogo: [PresentMon](https://github.com/GameTechDev/PresentMon)
  (`PresentMon.exe --process_name <jogo>.exe --timed 60 --output_file C.csv`)
  ou o CapFrameX. Anotar FPS médio e 1% low.
- CPU/GPU por processo:

  ```powershell
  typeperf "\Process(Salinha*)\% Processor Time" "\Process(concord-audio*)\% Processor Time" "\Process(dwm)\% Processor Time" -si 1 -sc 60 -o cpu-C.csv
  typeperf "\GPU Engine(*engtype_3D)\Utilization Percentage" -si 1 -sc 60 -o gpu-C.csv
  ```

  Ou Gerenciador de Tarefas → Detalhes → colunas "GPU", "Mecanismo de GPU" e
  "Memória dedicada da GPU": comparar os processos da Salinha (o de GPU some do
  topo no cenário C), o `concord-audio.exe` e o `dwm.exe`.

### O que mandar de volta

- FPS médio e 1% low de A, B e C (ou os CSVs do PresentMon).
- Os CSVs do `typeperf` (ou prints do Gerenciador de Tarefas em B e C).
- O `audio.log` da sessão.
- Prints do overlay nativo e do antigo lado a lado (normal, falando, editando)
  e qualquer item do checklist que falhou.
