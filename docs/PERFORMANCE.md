# Medição de performance (Windows)

Linha de base para provar que uma mudança melhorou (ou piorou) o consumo do app.
É uma ferramenta de **dev**: só roda com a flag `--perf-log` (ou a variável
`SALINHA_PERF_LOG=1`). Sem ela nada é observado, enviado ou gravado.

O que é medido, uma amostra por segundo:

- **CPU e RAM por tipo de processo** (Browser, Tab, GPU, Utility, Other).
- **FPS** e **Long Animation Frames** (quadros acima de 50 ms) do renderer.
- **Contexto** de cada amostra: janela `visible` / `minimized` / `tray`, rota,
  em chamada, transmitindo tela, assistindo tela.
- **Abertura**: app pronto, janela pronta e "primeira tela usável" (lista de
  servidores carregada), em ms desde o início do processo.

## Como medir

Meça sempre o app **empacotado**: o dev server do Vite (sem minificar, com HMR)
distorce abertura e CPU.

1. `cd frontend && yarn build:unpack`
2. Feche o Salinha instalado (o app aceita uma instância só).
3. Abra `frontend\dist\win-unpacked\Salinha.exe --perf-log`.
4. O arquivo é gravado em `%APPDATA%\Concord\perf\perf-AAAAMMDD-HHmmss.jsonl`
   (uma linha JSON por amostra; a última linha é `{"kind":"end"}` quando o app
   fecha normalmente).

## Roteiro dos cenários

O relatório agrupa sozinho pelo contexto, então basta percorrer o roteiro sem
marcar nada. Cada troca de contexto descarta os 10 s iniciais.

| # | Cenário | Duração |
|---|---|---|
| 1 | Janela visível, parada, num canal de texto | 2 min |
| 2 | Janela fechada na bandeja | 2 min |
| 3 | Rolando um canal com muitas mensagens | 1 min |
| 4 | Em chamada de voz | 2 min |
| 5 | (opcional) Transmitindo tela | 2 min |
| 6 | (opcional) Assistindo a tela de alguém | 2 min |

O cenário 3 cai no mesmo contexto do 1 (`visible`); para separá-los, grave um
arquivo por cenário.

Para comparar duas versões: mesma máquina, mesmo roteiro, app recém-aberto,
nada pesado rodando ao lado. Se a diferença for pequena, repita.

## Ler o relatório

```bash
node scripts/perf-report.mjs perf.jsonl                  # um arquivo
node scripts/perf-report.mjs antes.jsonl depois.jsonl    # antes → depois e Δ%
```

- **CPU total %**: soma dos processos, em % da máquina inteira (média e p95).
- **RAM total MB**: soma do working set dos processos.
- **FPS (p5)**: o pior 5% dos segundos; mais alto é melhor.
- **LoAF por minuto / máx**: quadros acima de 50 ms; menos é melhor.
- FPS e LoAF só existem no contexto `visible`: com a janela minimizada ou na
  bandeja o Chromium limita a animação a 1 Hz, o que daria um falso "quadro
  longo" por segundo. Nesses contextos compare CPU e RAM.
- `tray` é a janela oculta pelo botão de fechar; `minimized` é a minimizada.
- **(amostra pequena)**: menos de 30 amostras válidas no contexto; não confie.
- `—` quer dizer que a métrica não existe naquele arquivo/contexto.
- Aviso de "sem linha end": o app fechou de forma abrupta; os dados valem.

## Privacidade

Da rota só ficam os segmentos fixos conhecidos (`servers`, `channels`, `dm`,
`convite`...); todo o resto vira `:id`, inclusive o código de convite. O arquivo
não guarda mensagens nem nomes. Se uma rota nova aparecer como `:id`, inclua o
segmento em `FIXED_SEGMENTS` (`frontend/src/shared/perfLog.ts`). Mesmo assim,
olhe o arquivo antes de anexá-lo a um PR.

## Investigar um número ruim

O `--perf-log` diz **quanto**; para descobrir **por quê**, use o Chromium:

- Abertura: `Salinha.exe --trace-startup --trace-startup-file=%TEMP%\trace.json`
- Rolagem e chamadas: aba **Performance** do DevTools (Ctrl+Shift+I).

Abra o trace em `chrome://tracing` ou em <https://ui.perfetto.dev>. Isso é
investigação; a comparação entre PRs usa sempre o relatório acima.

# Banco de medição automatizado (CPU/GPU em segundo plano)

O `--perf-log` acima mede o uso real, sem roteiro fixo. Para provar que uma
otimização de CPU/GPU funcionou, use o banco automatizado: ele sobe o **build de
produção** (`electron-vite build` + electron, não o dev server) com um perfil
isolado, entra com contas de teste num backend local, passa por cenários fixos e
grava uma amostra por segundo.

```bash
# 1. Backend + LiveKit locais (num terminal à parte). Com SMTP vazio o backend
#    imprime o link de confirmação de e-mail no log, que o banco usa.
scripts/server-up.sh 2>&1 | tee /tmp/backend.log

# 2. O banco (≈ 30 min com os padrões). Constrói com VITE_SERVER_URL da --api.
node scripts/perf-bench.mjs --label antes --api http://localhost:8080/api \
  --backend-log /tmp/backend.log --shots --trace b,d,e

# 3. Comparar dois resultados
node scripts/perf-bench.mjs --compare antes.json depois.json
```

Opções: `--reps 3` (repetições; vale a mediana), `--warmup 15` e `--duration 60`
(segundos por cenário), `--scenarios a,b,c,d,e,g`, `--skip-build`, `--out <pasta>`
(padrão: `$TMPDIR/salinha-perf-bench`, onde ficam o JSON, as contas de teste
reaproveitadas em `seed.json`, as capturas de `--shots` e os traces de `--trace`).
O backend limita cadastros por IP: o banco cria as contas uma vez e reaproveita.

O que é gravado a cada 1 s:

- **CPU por tipo de processo** pelo `app.getAppMetrics()` (delta de
  `cumulativeCPUUsage`), em **% de um núcleo** (100 = um núcleo inteiro): Browser
  (main), GPU, Tab (renderer), Utility (áudio, rede).
- **GPU busy %** do `/sys/class/drm/card*/device/gpu_busy_percent` (amdgpu; lido a
  cada 100 ms e tirada a média do segundo). É a GPU **inteira** (compositor e
  outros apps entram), então compare sempre com a mesma máquina parada: aqui,
  sem o app, ~4%.
- **RAM** (working set somado).

No fim: média e p95 de cada métrica por cenário (mediana das repetições), em
markdown e JSON. `--trace` grava 10 s de trace do Chromium (`contentTracing`) por
cenário depois das repetições, para achar o culpado (abra em
<https://ui.perfetto.dev>).

## Cenários

| # | Cenário | Como |
|---|---|---|
| a | Canal de texto, janela com foco | canal com 40 mensagens, servidor com o Maestro na lista |
| b | O mesmo, janela sem foco | o foco volta para outra janela; a do app continua visível (segundo monitor / atrás do jogo) |
| c | O mesmo, minimizada | `win.minimize()` |
| d | Em call de voz (só áudio), sem foco | outra pessoa (Chromium headless, microfone falso) na call |
| e | Em call assistindo uma transmissão, sem foco | a outra pessoa transmite a tela (captura falsa do Chromium) |
| f | Overlay de jogo | só no Windows (o overlay depende do helper e de jogo em tela cheia): ver o roteiro abaixo |
| g | Em call assistindo uma transmissão, minimizada | como o e, minimizada |

No Hyprland a janela vai para um **monitor virtual** (`hyprctl output create
headless`), desenhado pela GPU de verdade mas fora da tela de quem usa o PC; o
cenário "com foco" rouba o foco do teclado enquanto mede. O Hyprland não
minimiza: o banco chama o `minimize()` do Electron e tira a janela da tela. Em
outros sistemas o banco usa só `focus()`/`blur()`/`minimize()` do Electron.

## Linha de base (antes das otimizações)

Arch Linux, Hyprland (Wayland), Ryzen 16 threads, GPU integrada AMD Lucienne.
CPU em % de um núcleo; média / p95; mediana de 3 repetições de 60 s.

| Cenário | CPU total | main | GPU | renderer | Utility | GPU busy % | RAM MB |
|---|---|---|---|---|---|---|---|
| a texto, foco | 17.0 / 20.9 | 1.8 / 3.0 | 6.5 / 8.0 | 8.0 / 9.0 | 0.9 / 4.0 | 12.0 / 14.2 | 845 |
| b texto, sem foco | 16.9 / 21.0 | 1.8 / 3.0 | 6.6 / 9.0 | 8.4 / 11.0 | 0.1 / 1.0 | 12.3 / 14.8 | 842 |
| c texto, minimizada | 15.2 / 19.0 | 0.8 / 2.0 | 6.3 / 8.0 | 8.1 / 10.0 | 0.1 / 1.0 | 9.1 / 10.9 | 841 |
| d call de voz, sem foco | 111.6 / 140.6 | 6.9 / 8.0 | 40.1 / 52.9 | 54.3 / 72.8 | 10.3 / 13.0 | 42.4 / 47.0 | 881 |
| e call assistindo tela, sem foco | 145.1 / 165.4 | 6.8 / 8.0 | 58.8 / 69.7 | 69.7 / 79.7 | 9.8 / 12.0 | 82.5 / 87.0 | 911 |
| g call assistindo tela, minimizada | 151.3 / 187.8 | 3.6 / 5.0 | 62.0 / 78.5 | 74.3 / 93.7 | 11.3 / 14.0 | 46.8 / 53.2 | 922 |

Leitura: sem foco e minimizado gastam quase o mesmo que em foco — o app não
economiza nada em segundo plano. Em call, mais de um núcleo inteiro e até 80% da
GPU integrada, mesmo minimizado.
