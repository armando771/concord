# Chroma key na câmera

Issue #225 (proposta da comunidade, 6 a 0).

## Objetivo

O usuário remove ou troca o fundo da própria câmera em tempo real (pano verde ou
azul), com prévia ao vivo. Quem está na chamada vê o resultado.

## Decisões

- **Processa no remetente.** A câmera passa por um canvas e a track publicada no
  LiveKit é a do `canvas.captureStream(30)`. A prévia local e os outros usuários
  recebem o mesmo vídeo; backend e receptor não mudam.
- **Sem transparência.** WebRTC não carrega canal alfa. O fundo removido é
  preenchido com uma cor sólida ou uma imagem escolhida (cover-fit).
- **Algoritmo.** Distância no plano Cb/Cr (ignora brilho, então sombras do pano
  não escapam), `similarity` (sensibilidade) e `smoothness` (borda macia) e
  remoção do vazamento de verde/azul nos pixels mantidos. Sem ML nem
  dependência nova.
- **Desempenho.** Processa em até ~960x540 (`CHROMA_MAX_PIXELS`), no loop de
  `requestVideoFrameCallback` (fallback rAF). O laço do pixel compara distâncias
  ao quadrado e só tira raiz na faixa de transição: ~4 ms por quadro a 960x540
  (era ~19 ms com `Math.hypot`). Desligado, o pipeline nem é criado.
- **Configurações valem ao vivo.** O pipeline lê as configurações a cada quadro.
  Só ligar/desligar o efeito recria a câmera (muda o stream publicado).
- **Persistência local** (`concord-chroma-key`), como as outras preferências de
  mídia. Dado corrompido volta ao padrão; quota cheia (imagem grande) não
  quebra o ajuste. A imagem fica como JPEG de até 1280x720.
- **Falha do pipeline** cai para a câmera crua, com aviso.

## Arquivos

- `lib/chromaKey.ts`: algoritmo e validação (puro, testado em node).
- `lib/chromaKeyPipeline.ts`: canvas + loop + `captureStream`, com o navegador
  injetável para teste.
- `lib/chromaKeyImage.ts`: reduz a imagem de fundo escolhida.
- `store/chromaKeyStore.ts`: configurações persistidas.
- `store/callStore.ts`: `toggleCamera`, fim da chamada e reinício ao ligar/desligar.
- `components/ChromaKeySettings.tsx` e `useChromaKeyPreview.ts`: Configurações →
  Voz, com prévia Original x Resultado.

## Fora do escopo

- Segmentação por IA (sem pano), desfoque de fundo e atalho no painel da call.
- Worker/OffscreenCanvas: só se a medição em máquina fraca pedir.
