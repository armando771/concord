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
