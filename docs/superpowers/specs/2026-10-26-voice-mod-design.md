# Voice mod e refatoração da Mesa de Áudio

## Objetivo

Cada usuário pode alterar a própria voz na chamada (voice mod). A configuração
fica dentro da Mesa de Áudio, que ganha uma estrutura com barra lateral de ícones
para comportar Sons e Voz (e o que vier depois).

## Decisões

- Presets com sliders de ajuste: **Normal, Grave, Esquilo, Robô, Eco, Rádio**.
- Sliders: **Tom** (-12 a +12 semitons), **Timbre** (-1 a 1), **Intensidade** (0 a 1).
- Configuração dentro da Mesa de Áudio (popover), seção "Voz".
- Layout da Mesa de Áudio: barra lateral de ícones à esquerda (opção B), seções
  **Sons** e **Voz**. O volume da mesa continua fixo no cabeçalho.
- Sem vozes que imitem pessoas reais. Só efeitos e vozes de personagem genéricas.

## Áudio

O efeito é aplicado no lado de quem fala, então todos na chamada ouvem a voz
alterada. Entra em `noiseSuppression.ts`, depois do ganho de entrada e antes do
worklet de detecção de voz:

```
mic ─ RNNoise ─ inputGain ─ [ VOICE MOD ] ─ detecção/portão ─ destino
```

A faixa enviada continua sendo a mesma, então trocar de preset ou mexer num
slider vale ao vivo, sem republicar nada no LiveKit.

Novo módulo `lib/voiceMod.ts` (recebe e devolve um nó de áudio):

| Controle | Implementação |
| --- | --- |
| Tom | Pitch shifter granular em AudioWorklet (latência ~20–40 ms) |
| Timbre | Aproximação de formante com shelf de graves e agudos (voz mais "grossa" ou mais "fina"). Não é formante verdadeiro |
| Intensidade | Mistura dry/wet com crossfade, como a supressão de ruído |
| Robô | Modulação em anel (oscilador × voz) |
| Eco | Delay com feedback |
| Rádio | Passa-faixa mais saturação leve |

Preset `normal` = bypass (sinal passa direto, sem custo nem latência extra).

Fallback: se o worklet não carregar, o microfone segue normal e o voice mod
fica indisponível, sem derrubar a chamada (mesmo tratamento do RNNoise).

## Estado

`store/voiceModStore.ts`, zustand com `persist` (chave `concord-voice-mod`),
no padrão de `voiceAudioStore`.

- Campos: `preset`, `pitch`, `timbre`, `intensity`.
- Escolher um preset preenche os três sliders. Mexer num slider depois marca o
  preset como "personalizado".
- `subscribe` aplica a mudança em todo microfone aberto, ao vivo (como a
  supressão de ruído).

## Interface

- `SoundboardPopover` vira contêiner: cabeçalho, volume fixo e trilho de ícones.
- Conteúdo atual (busca, pads, upload, atalhos) sai para `SoundboardSoundsPanel.tsx`.
- Novo `VoiceModPanel.tsx`: grade de presets, 3 sliders e botão "Ouvir" para o
  usuário escutar a própria voz alterada (com fone).
- Largura do popover: 380 → ~480 px. Continua abrindo de `VoiceControls` e
  `VoiceConnectedPanel`.
- O ícone do botão da Mesa de Áudio mostra um indicador quando há voice mod ativo.
- Ícone da Mesa de Áudio trocado por um mixer com faders (já feito).

## Testes

- `voiceModStore`: presets, limites, persistência.
- `voiceMod.test.ts`: lógica pura que converte preset em parâmetros de áudio.
- O worklet é testado à mão ouvindo (jsdom não roda Web Audio).

## Fora da v1

- Vozes de personagem além dos presets acima.
- Formante verdadeiro (phase vocoder com envelope espectral).
- Sincronizar a escolha entre dispositivos.
