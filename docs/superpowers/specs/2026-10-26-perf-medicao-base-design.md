# Medição base de performance (Windows) — design

Sub-projeto **0** da iniciativa "melhorar a performance do app no Windows em
todas as formas". A iniciativa foi dividida em sub-projetos, cada um com spec,
plano e PR próprios:

| # | Sub-projeto | Status |
|---|---|---|
| **0** | **Medição base** (esta spec) | design aprovado |
| 1 | Ocioso/bandeja: throttling só desligado com live/captura ativa | a fazer |
| 2 | Abertura e bundle: fontes sob demanda, `React.lazy` nas telas pesadas | a fazer |
| 3 | Chat: virtualizar as listas de mensagens | a fazer |
| 4 | Chamadas: custo de supressão de ruído e desfoque de fundo | a fazer |

## Objetivo

Ter números comparáveis entre PRs para CPU, RAM (por tipo de processo), tempo
de abertura e fluidez (FPS e Long Animation Frames) do app **empacotado** no
Windows, em cenários fixos: parado visível, na bandeja, rolando um chat grande,
em chamada. Sem essa linha de base, os sub-projetos 1–4 não conseguem provar
ganho.

## Decisões

1. **Só para dev, ligado por flag** (`--perf-log` no argv ou
   `SALINHA_PERF_LOG=1`). Sem a flag nada roda (nenhum timer, observer ou
   arquivo). *Por quê:* zero custo para usuários, sem UI nem texto para
   aprovar, sem questão de privacidade.
2. **Funciona no app empacotado.** *Por quê:* o dev server do Vite (sem minificar,
   HMR) distorce abertura e CPU; o número que importa é o do instalado.
3. **Amostrador próprio gravando JSONL + script de relatório** (abordagem 1 de
   3). Alternativas avaliadas:
   - `contentTracing`/trace do Chromium aberto no Perfetto: detalhe máximo, mas
     arquivos enormes e análise manual, sem número fácil de comparar. Fica
     documentado no roteiro como ferramenta de **investigação** (sem código).
   - Só renderer reusando `app-metrics:sample`: dá só o total do app, sem
     quebra por processo, sem abertura nem bandeja.
   - Automação dos cenários com Playwright: dependência nova (ADR), frágil com
     login e LiveKit. Fora de escopo.
4. **Contexto automático em vez de marcar cenário à mão.** Cada amostra leva
   estado da janela, rota, `inCall`, `sharing` e `watching`; o relatório
   agrupa por isso. *Por quê:* sem atalho, sem UI, sem erro humano ao rotular.
5. **Long Animation Frames (>50 ms) + FPS por `requestAnimationFrame`** para
   fluidez. *Por quê:* LoAF é a métrica que mais se aproxima do engasgo
   percebido (Chrome 123+, Electron 44 tem); FPS por rAF complementa na rolagem.
6. **Rota normalizada** (IDs → `:id`). *Por quê:* o arquivo pode ser
   compartilhado no PR sem dados pessoais.
7. **Sem ADR**: segue o padrão do repo (main por responsabilidade, IPC via
   preload, script em `scripts/` com lib pura testada). Sem dependência nova.

Referências: [Chromium tracing em Electron (Scott Logic)](https://blog.scottlogic.com/2019/05/21/analysing-electron-performance-chromium-tracing.html),
[Electron contentTracing](https://www.electronjs.org/docs/latest/api/content-tracing),
[Sentry Electron: tempo de abertura](https://github.com/getsentry/sentry-electron/issues/523),
[Long Animation Frames API](https://developer.chrome.com/docs/web-platform/long-animation-frames).

## Arquitetura

```
frontend/src/
  shared/perfLog.ts                    tipos das linhas do JSONL e do evento perf:report
                                       + normalizeRoute (IDs → :id), puro
  main/perf/
    perfFlag.ts                        isPerfLogEnabled(argv, env), puro
    processBreakdown.ts                agrupa app.getAppMetrics() por tipo
                                       (Browser/Tab/GPU/Utility; demais em "Other"),
                                       uma instância de AppMetricsSampler por tipo
    perfRecorder.ts                    abre userData/perf/perf-<AAAAMMDD-HHmmss>.jsonl,
                                       acrescenta linhas, fecha com {"kind":"end"}
    startupMarks.ts                    classe StartupMarks: junta os 3 marcos de abertura
                                       numa linha (ou null no que faltou, aos 60 s)
    windowState.ts                     visible | minimized | tray a partir da janela
    perfSession.ts                     junta o relatório do renderer com a amostra do
                                       main e escreve as linhas (startup e sample)
    setupPerfLog.ts                    só a ligação com o Electron: flag, timer de 1 s,
                                       IPC 'perf:enabled' e 'perf:report', before-quit
  main/index.ts                        + setupPerfLog(() => mainWindow), PRIMEIRA
                                       chamada do whenReady (2 linhas + import)
  preload/index.ts                     + window.api.perf =
                                       { enabled(): Promise<boolean>, report(evento) }
  preload/index.d.ts                   + tipo de window.api.perf
  renderer/src/
    shared/lib/perf/frameStats.ts      puro: FPS da janela de 1 s e resumo de LoAF
    app/perfContext.ts                 puro: rota + estado da chamada → PerfContext
    app/perfReporting.ts               rAF + PerformanceObserver (LoAF) + timer de 1 s;
                                       lê rota e callStore (somente leitura), envia
                                       perf:report; o mark "usable" vem da inscrição em
                                       serverStore.serversLoaded (nenhum componente muda)
    app/PerfBridge.tsx                 pergunta ao main (perf:enabled) e só então liga
                                       o perfReporting
    app/App.tsx                        + <PerfBridge /> ao lado do <BackgroundBridge />,
                                       sem condicional (o App tem CRAP 12)
scripts/
  perf-report.mjs                      CLI: resumo de um arquivo ou comparação de dois
  lib/perfReport.mjs                   puro: parse tolerante, agrupamento, média/p95, Δ%
  lib/perfReport.test.mjs
docs/PERFORMANCE.md                    roteiro dos cenários + trace do Chromium
```

Restrições respeitadas:
- `main/index.ts` (378 linhas) ganha 3 linhas (import, comentário e chamada) e
  fica em 381, abaixo de 400.
- A flag chega ao renderer por IPC: o argv do app **não é repassado** aos
  renderers pelo Chromium, então o preload não consegue lê-lo. O renderer chama
  `perf:enabled` e o main responde `true` só quando a gravação abriu.
- Nenhum campo novo em god store: o `perfReporting` só **lê** `callStore`
  (`status === 'active'` → `inCall`, `isScreenSharing` → `sharing`,
  `watchedScreenIds.length > 0` → `watching`).
- `shared/` não importa de `features/`: a leitura do `callStore` e do
  `serverStore` fica no `perfReporting`, que mora em `app/`.
- Build web: sem `window.api`, o `PerfBridge` não monta.

## Fluxo de dados

**Renderer → main (`perf:report`, a cada 1 s, só com a flag):**

```ts
{ kind: 'report',
  ctx: { route: string, inCall: boolean, sharing: boolean, watching: boolean },
  fps: number | null,            // null se document.hidden
  loaf: { count: number, maxMs: number, totalMs: number } | null }  // null sem suporte
```

Uma vez: `{ kind: 'mark', name: 'usable' }`, quando a lista de servidores
renderiza pela primeira vez.

O main ignora `perf:report` de outro `sender`/frame (mesma checagem do
`app-metrics:sample`) e de formato inválido.

**Main, a cada 1 s → linha `sample`:**

```jsonl
{"t":12.0,"kind":"sample","ctx":{"window":"tray","route":"/channels/:id","inCall":false,"sharing":false,"watching":false},"procs":{"Browser":{"cpu":0.4,"memMB":92},"Tab":{"cpu":1.1,"memMB":210},"GPU":{"cpu":0.8,"memMB":140},"Utility":{"cpu":0.1,"memMB":35}},"fps":null,"loaf":{"count":0,"maxMs":0,"totalMs":0}}
```

- `t`: segundos desde o início do processo (`process.uptime()`).
- `ctx.window`: `visible` | `minimized` | `tray` (oculta). A bandeja é detectada
  pelos eventos `show`/`hide` da janela: no Windows uma janela minimizada e depois
  oculta tem `isMinimized()` true e `isVisible()` false, igual a uma só minimizada.
  `fps` e `loaf` só existem com a janela `visible` (fora disso o rAF cai para 1 Hz
  e cada segundo viraria um "quadro longo" de ~1000 ms).
- `ctx` (rota e flags), `fps` e `loaf` vêm do último `perf:report`; se o último
  tiver mais de 2 s, `fps` e `loaf` saem `null` (nunca 0 inventado).
- CPU em % do total da máquina (mesma fórmula do `AppMetricsSampler`). Na
  primeira amostra a CPU de cada tipo é `null` (CPU é a diferença entre duas
  leituras) e o relatório a ignora. Tipo de processo sem nenhum processo não
  aparece em `procs`.
- Sem nenhum relatório do renderer ainda, o contexto sai com `route: ""` e as
  flags `false`.

**Linha `startup`** (uma vez, quando os 3 marcos chegaram ou aos 60 s):

```jsonl
{"kind":"startup","appReadyMs":310,"readyToShowMs":1240,"usableMs":2050}
```

Tempos medidos a partir do início do processo. `usable` pode chegar antes ou
depois de `ready-to-show` (janela iniciada oculta na bandeja); cada campo é
gravado com o tempo em que aconteceu, `null` se não aconteceu até 60 s.
`appReadyMs` é o instante em que o `setupPerfLog` roda, que é a primeira
chamada do `whenReady`. Se o usuário só entrar depois de 60 s, `usableMs` fica
`null`: a medida vale para abertura a frio com sessão já salva.

**Linha `end`** no `before-quit`: `{"kind":"end","t":…}`.

**Relatório** (`node scripts/perf-report.mjs a.jsonl [b.jsonl]`):
- Abertura: `appReadyMs`, `readyToShowMs`, `usableMs`.
- Por contexto (chave: `window` + `inCall` + `sharing` + `watching`):
  CPU total (média, p95), RAM total (média), CPU/RAM por tipo de processo,
  FPS p5, LoAF por minuto, LoAF máx.
- Descarta os primeiros 10 s depois de cada troca de contexto.
- Contexto com < 30 amostras válidas recebe o aviso "amostra pequena".
- Com dois arquivos: colunas antes/depois e Δ%.
- Ignora linhas corrompidas (conta e avisa) e aceita arquivo sem `end`.

## Erros

- Falha ao criar a pasta ou o arquivo: um aviso via `appendLog` e a medição
  desliga; o app segue normal.
- Falha ao escrever uma linha: a linha é descartada e as próximas são tentadas.
- `PerformanceObserver` sem `long-animation-frame`: `loaf: null`.
- Crash: o arquivo fica sem `end`; o relatório trata.

## Textos aprovados

Nenhum texto para o usuário final: não há UI. As mensagens do
`perf-report.mjs` e o `docs/PERFORMANCE.md` são para devs.

## Testes (TDD)

- `main/perf/perfFlag.test.ts`: argv, env, desligado.
- `main/perf/processBreakdown.test.ts`: agrupamento por tipo, tipo desconhecido
  em "Other", delta de CPU por processo; processo novo no meio não gera pico.
- `main/perf/startupMarks.test.ts`: `usable` antes e depois do `ready-to-show`,
  marco ausente vira `null`.
- `shared/perfLog.test.ts`: `normalizeRoute` troca IDs por `:id`.
- `renderer/src/shared/lib/perf/frameStats.test.ts`: FPS da janela de 1 s,
  LoAF só > 50 ms, contagem/máx/soma, reset entre janelas.
- `scripts/lib/perfReport.test.mjs`: agrupamento, descarte de 10 s, p95,
  "amostra pequena", Δ%, sem `end`, linha corrompida.
- `setupPerfLog.ts`, `perfRecorder.ts` e `PerfBridge.tsx` são ligação/IO fina,
  com CRAP ≤ 15, cobertos pela verificação de ponta a ponta.

## Fora de escopo

- Qualquer otimização (sub-projetos 1–4).
- UI/painel para o usuário e telemetria enviada ao servidor.
- Automação dos cenários (Playwright).
- Orçamentos que reprovam PR (vêm depois da linha de base).
- Roteiro para macOS/Linux (o código não pode quebrar lá, mas não é medido).

## Verificação de ponta a ponta

1. `yarn build:unpack` e abrir `dist/win-unpacked/Salinha.exe --perf-log`.
2. Seguir o roteiro do `docs/PERFORMANCE.md`: 2 min visível parado, 2 min na
   bandeja, 1 min rolando um canal grande, 2 min em chamada.
3. Conferir que `perf-*.jsonl` em `userData/perf/` tem `startup`, os 4
   contextos e `end`.
4. `node scripts/perf-report.mjs <arquivo>` mostra a tabela com os 4 contextos;
   rodar com o mesmo arquivo duas vezes mostra Δ 0%.
5. Abrir **sem** a flag e confirmar que nenhum arquivo é criado.
6. `node scripts/affected-tests.mjs pr` verde.
7. Anexar o relatório da linha de base ao PR (é o "antes" dos sub-projetos 1–4).
