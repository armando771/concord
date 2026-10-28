# 0012. Falar as mensagens /tts no app de cada um (Web Speech), decidindo no cliente quem ouve

- Status: aceito; no app desktop do Linux, emendado pelo [0014](0014-voz-piper-no-linux.md)
- Data: 2026-10-28

## Contexto

Issue #352: a pessoa digita `/tts <mensagem>` no chat e uma voz lê a mensagem,
mas só para quem está em alguma call no momento. Forças:

- a maioria usa o app desktop no Windows; há também o app web (Chrome, celular)
  e uma minoria em Linux;
- a mídia das calls vai direto para o LiveKit, o Go nunca toca em áudio;
- `message:create` de canal já só chega a quem vê o canal (o Hub filtra pela
  sala do servidor), e o estado da minha call (servidor, DM, ensurdecido) está
  no `callStore` do app;
- sem dependência nova sem ADR; `message/service.go`, `message/handler.go`,
  `ChatPane.tsx` e o `chatStore` são god files.

## Opções consideradas

1. **Web Speech API (`speechSynthesis`) no app de quem ouve.** A mensagem é uma
   mensagem comum com `tts = true`; cada app, ao receber o `message:create`,
   decide se fala. Prós: zero dependência e zero custo de servidor; no Windows
   o Chromium usa as vozes do sistema (SAPI/OneCore, "Microsoft Maria" no
   Windows em português); no Chrome há as vozes do Google; respeita
   ensurdecer e a preferência local sem nenhuma ida ao servidor. Contras: a voz
   depende do sistema (Windows em inglês pode só ter voz em inglês); no Linux o
   Chromium/Electron só fala com `speech-dispatcher` instalado e configurado
   (sem ele `getVoices()` vem vazio e nada toca); a fala não aceita
   `setSinkId`, então sai na saída padrão do sistema, não na escolhida no app.
2. **Gerar o áudio no servidor** (Piper ou espeak-ng) e mandar o arquivo ou
   publicar na sala do LiveKit. Prós: mesma voz para todo mundo, dá para usar a
   saída escolhida. Contras: binário e modelos novos no deploy (dependência),
   CPU por mensagem, armazenamento ou um participante de áudio no LiveKit, e
   ainda assim cada app precisa decidir quem ouve. Caro para o pedido.
3. **Serviço externo de TTS** (Google/Azure/ElevenLabs). Prós: vozes boas.
   Contras: custo por caractere, chave para guardar, texto das conversas
   saindo para terceiros, mais um ponto de falha.

## Decisão

Opção 1, no mesmo padrão do som de entrada (ADR 0002): um ouvinte do WS
(`features/tts/lib/ttsStart.ts`) recebe o `message:create`, aplica a regra pura
de quem ouve (`ttsListen.ts`) e põe a fala numa fila (`ttsQueue.ts`) que fala
uma mensagem por vez. A voz escolhida é a primeira `pt-BR` (depois `pt-*`); sem
voz nenhuma, nada toca e a mensagem fica só no chat.

Quem ouve: quem recebeu a mensagem (logo vê o canal, ou é da DM), está numa
call **ativa** do mesmo servidor (canal) ou na call daquela DM, não está
ensurdecido (nem pelo servidor) e não desligou "Ouvir mensagens de TTS"
(Configurações → Voz, guardado neste aparelho). Quem envia também ouve, se
estiver em call, como no Discord.

No backend, a mensagem TTS é uma mensagem comum com a coluna `messages.tts`,
criada por rota própria (`POST /channels/:id/tts`, `POST /conversations/:id/tts`
em `message/tts*.go`), sem mexer no `service.go` nem no `handler.go`: texto de
até 200 caracteres, uma mensagem TTS a cada 10 s por pessoa (em memória; o 429
leva `retry_after`) e, em canal, a permissão nova **Enviar mensagens TTS**
(`SEND_TTS_MESSAGES`, bit `1<<30`, cai junto sem *Enviar mensagens*). Na DM
vale quem pode escrever nela.

A permissão vem **ligada no @everyone** (servidores novos e, pela migration
000127, os existentes). O Discord a deixa desligada, mas aqui os servidores são
de amigos, o pedido é que qualquer um use, e o abuso já é contido pelo limite
de tamanho, pelo intervalo de 10 s, pela fila e pelo interruptor de quem ouve.
Quem quiser restringir desliga no cargo ou no canal.

No app, o `/tts texto` digitado no campo sai pela rota própria
(`features/tts/api/tts.ts`, chamado de `chat/api/messages.ts`), então a bolha
"enviando…", a nova tentativa e a restauração do texto que falhou continuam
as do chat comum. O `/tts` aparece no menu do "/" (com o Maestro, em canal; sozinho, na DM) para
quem tem a permissão. O `message:create` de canal chega pela sala do canal e
pela do servidor: o ouvinte lembra os ids para falar uma vez só.

O texto falado é "<nome> disse: <mensagem>", com `@nick` trocado pelo nome de
exibição (apelido no servidor, quando o app conhece), links viram "link" e
emojis saem.

## Consequências

- No Linux sem `speech-dispatcher` o app não fala (sem erro); no Windows em
  inglês a voz lê com sotaque. Fica registrado; trocar de motor é trocar só o
  `ttsEngine.ts`.
- A fala sai na saída padrão do sistema, não na "Saída de áudio" escolhida no
  app (a Web Speech API não tem `setSinkId`). O volume segue o "Volume de
  saída" (até 100%).
- Ensurdecer, sair da call ou desligar o interruptor para a fala atual e
  esvazia a fila. A fila guarda no máximo 5 falas: numa rajada as mais antigas
  caem.
- O cooldown fica na memória do processo: um reinício zera, sem problema.
- App antigo recebe a mensagem como texto comum (sem voz nem ícone).

## Fontes

- Web Speech API, `SpeechSynthesis`: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
- Speech Dispatcher necessário para a SpeechSynthesis no Linux: https://support.mozilla.org/en-US/kb/speechd-setup
- Backend Linux do TTS no Chromium (speech-dispatcher): https://chromium.googlesource.com/chromium/src/+/lkgr/content/browser/speech/tts_linux.cc
- Saída de áudio para a Web Speech API (sem `setSinkId`): https://lists.w3.org/Archives/Public/public-webrtc-logs/2020Sep/0208.html
- Piper (TTS local no servidor, descartado): https://github.com/rhasspy/piper
- Permissão "Send TTS Messages" do Discord: https://discord.com/developers/docs/topics/permissions
