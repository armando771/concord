# 0014. No app desktop do Linux, falar o /tts com o Piper baixado no primeiro uso

- Status: aceito (emenda o [0012](0012-tts-no-cliente.md) só no app desktop do Linux)
- Data: 2026-10-28

## Contexto

O ADR 0012 fala as mensagens /tts com a Web Speech API no app de quem ouve. No
Windows funciona com as vozes do sistema. No Linux o Chromium/Electron só usa o
`speech-dispatcher` com `--enable-speech-dispatcher` e ainda depende de um motor
instalado no PC: na prática não fala. Forças:

- Windows e o app web não podem mudar;
- nada roda no servidor (o Go nunca toca em áudio) e nada é baixado da nossa VPS;
- o instalador do Linux não pode crescer;
- sem dependência nova no `package.json` sem ADR (este é o ADR, e não há
  pacote npm novo: o binário e a voz vêm de fora, em tempo de execução);
- a fala deveria sair na "Saída de áudio" escolhida no app, o que a Web Speech
  não faz.

## Opções consideradas

1. **Piper standalone + voz pt-BR baixados no primeiro uso** (escolhida). O
   main baixa o binário oficial do Piper e a voz das fontes oficiais, confere
   sha256 e tamanho fixos no código, sintetiza localmente (`spawn`) e devolve o
   WAV ao renderer, que toca pela saída das vozes. Prós: voz neural boa em
   português, sem nada no sistema, instalador do mesmo tamanho, saída e volume
   do app. Contras: ~90 MB baixados uma vez (112 MB em disco); a primeira
   mensagem não fala (só dispara o download).
2. **Ligar `--enable-speech-dispatcher` e pedir para instalar o
   speech-dispatcher + espeak-ng.** Prós: zero código. Contras: depende de
   pacote do sistema e de root; a voz do espeak é robótica; sai na saída padrão.
3. **Embutir o Piper no instalador do Linux.** Prós: fala de primeira. Contras:
   +90 MB no instalador e em cada atualização, para todo mundo, mesmo quem
   nunca ouve /tts.
4. **Piper em WASM no renderer** (piper-tts-web/sherpa-onnx). Contras:
   dependência npm nova grande, onnxruntime-web, e o modelo é o mesmo download.

## Decisão

Opção 1, só quando `process.platform === 'linux'` no Electron: o preload expõe
`window.api.tts` apenas no Linux e `features/tts/lib/ttsSpeaker.ts` escolhe o
`piperEngine.ts` quando ele existe; senão a Web Speech de sempre. A fila, quem
ouve, ensurdecer, o interruptor e os limites continuam os do 0012.

- **Binário:** `rhasspy/piper` release `2023.11.14-2`
  (`piper_linux_x86_64.tar.gz` e `piper_linux_aarch64.tar.gz`), que já traz
  espeak-ng-data, libespeak-ng e onnxruntime. O projeto foi arquivado e seguiu
  em `OHF-Voice/piper1-gpl`, que só publica wheels de Python (sem binário
  standalone); por isso fica a última release standalone. Outros processadores:
  sem voz ("Este processador não tem voz de leitura").
- **Voz:** `pt_BR-faber-medium` do `rhasspy/piper-voices` (Hugging Face), por
  URL fixa num commit (`5041a7a…`), 22 050 Hz.
- **Download** (`main/tts/`): `net.fetch` por HTTPS; tamanho e sha256 conferidos
  antes de extrair ou usar; tudo numa pasta `.staging-<versão>-<pid>` que só
  vira `<userData>/tts/<versão>/` no fim (rename), com uma marca "pronto"
  gravada por último; um download por vez; 3 tentativas (espera de 2 s e 8 s);
  versões antigas apagadas. A extração reaproveita a do updater do Linux
  (`main/app/tarGz.ts`).
- **Quando baixa:** na primeira mensagem /tts que a pessoa ouviria (essa fica
  só no chat) ou ao ligar o interruptor. Depois de um erro só baixa de novo
  pelo "Tentar de novo" (ou ao reabrir o app), para não insistir a cada mensagem.
- **Síntese:** `piper --model … --output_file - --quiet`, texto numa linha pelo
  stdin, WAV pelo stdout; uma por vez, morta com SIGKILL depois de 15 s ou
  acima de 10 MB. 200 caracteres levam ~1,2–1,5 s num PC comum (~11 s de fala).
- **Reprodução:** o WAV toca por `routeElementToOutput` (como o som de entrada):
  dispositivo escolhido em Configurações → Voz e volume de saída (até 150%).

## Licenças

- Piper (`rhasspy/piper`): MIT. O pacote traz a libespeak-ng (GPL-3.0) e o
  onnxruntime (MIT). Não redistribuímos nada: o app de cada pessoa baixa da
  fonte oficial e executa como programa separado.
- Voz `faber` (model card): dados próprios em CC0, **ajustada a partir da voz
  inglesa `lessac`**, cujo conjunto de dados (Blizzard 2013) é licenciado só
  para pesquisa, sem uso comercial. Todas as vozes pt_BR do piper-voices (faber,
  cadu, jeff, edresson) herdam uma base com restrição não comercial (lessac ou
  ryan, CC BY-NC-SA). A Salinha é um app gratuito, sem venda nem anúncio, e a
  voz não é redistribuída por nós; ficamos com a faber (a melhor das quatro).
  **Se a Salinha virar comercial, esta escolha precisa ser revista** (treinar
  uma voz a partir de base livre ou usar outro motor).

## Consequências

- No Linux a primeira mensagem /tts não fala: baixa ~90 MB (uma vez por
  versão da voz) e as próximas falam. Configurações → Voz mostra "Baixando…
  N%", "pronta" ou o erro com "Tentar de novo".
- Trocar de versão do Piper ou de voz é trocar as constantes de
  `main/tts/piperAssets.ts` (URL, sha256, tamanho e o nome da pasta); a pasta
  antiga é apagada sozinha.
- O binário roda fora do sandbox do renderer, com o texto pelo stdin (nunca
  como argumento) e só a partir de arquivos conferidos por sha256.
- Windows, macOS e o app web continuam exatamente com a Web Speech
  (`ttsSpeaker.test.ts`, `ttsSetup.test.ts`).

## Fontes

- Release standalone do Piper: https://github.com/rhasspy/piper/releases/tag/2023.11.14-2
- Piper arquivado, continuação (só wheels): https://github.com/OHF-Voice/piper1-gpl/releases
- Vozes: https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR
- Model card da faber: https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/faber/medium/MODEL_CARD
- Licença do conjunto lessac (Blizzard 2013): https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html
- Speech Dispatcher no Chromium: https://chromium.googlesource.com/chromium/src/+/lkgr/content/browser/speech/tts_linux.cc
- `net.fetch` do Electron: https://www.electronjs.org/docs/latest/api/net#netfetchinput-init
