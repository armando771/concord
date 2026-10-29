# 0019. O Maestro grava onde cada player estava e volta sozinho depois de o servidor reiniciar

- Status: aceito
- Data: 2026-10-28

## Contexto

O dono do produto: "após rodar o deploy de atualizações o Maestro para e é
preciso reiniciar as músicas". O Maestro (`internal/music`) guarda player,
fila e faixa atual só em memória; o deploy reinicia o backend
(`systemctl restart`) e nada recria o player. As calls já sobrevivem ao
reinício (espelhadas no banco e recarregadas no boot, `call.RestoreActive`),
e os badges e o nível do servidor já gravam o que está em memória no
desligamento (`a.badgeDone`).

Forças:

- O systemd manda SIGTERM para o cgroup inteiro (`KillMode` padrão): os ffmpeg
  e yt-dlp do Maestro morrem junto com o backend. O encoder caído virava
  "o Maestro caiu" no chat e o decoder morto "terminava" a faixa e avançava a
  fila antes de o processo sair.
- A URL de stream do YouTube expira; o ID do vídeo não.
- O boot não pode esperar o Maestro (baixar música leva segundos).
- Sem dependência nova; `manager.go` e `player.go` já passavam de 400 linhas.

## Opções consideradas

1. **Nada no banco: o processo novo pergunta ao antigo** (passar o estado
   por arquivo/socket no restart). Prós: sem tabela. Contras: não sobrevive a
   queda (kill -9, VPS reiniciando) e acopla os dois binários.
2. **Snapshot periódico (heartbeat) de todos os players.** Prós: cobre queda
   com no máximo N segundos de atraso. Contras: escrita constante no banco
   para um caso raro; o deploy, que é o caso comum, já tem o SIGTERM.
3. **Sessão por canal no banco, gravada a cada mudança do player e, com a
   posição exata, no desligamento; retomada no boot depois das calls.** O
   mesmo padrão das calls (espelho no banco + restore) e dos badges (gravar
   no SIGTERM).

## Decisão

Opção 3. Tabela `music_sessions` (migration 000167), uma linha por canal de
voz: call, servidor, canal de texto do último pedido, faixa atual (só ID do
vídeo e o que o painel mostra, com quem pediu), posição em ms, fila e quando
foi gravada.

- **Gravar**: cada `PublishState` do player agenda a gravação numa goroutine
  que junta mudanças seguidas e mantém a ordem por canal
  (`session_writer.go`); o player fechar de verdade (call acabou, ocioso,
  Maestro removido, queda fora do desligamento) apaga.
- **Desligar** (`Manager.Shutdown`, no `ctx.Done` do SIGTERM, antes de o
  banco fechar, junto com os badges): para de aceitar avisos, **congela** cada
  player (`Player.Freeze`: guarda a posição e passa a ignorar tudo o que os
  ffmpeg mortos fizerem) e grava a sessão final; só depois sai da sala do
  LiveKit.
- **Retomar** (`Manager.Resume`, 3 s depois do boot, em segundo plano, com
  teto de 1 min): descarta a sessão sem nada para tocar, com mais de 2 horas,
  com o Maestro indisponível ou removido do servidor, ou cuja call não existe
  mais ou está vazia. As outras voltam: o bot entra na sala, baixa de novo a
  faixa pelo ID e o ffmpeg começa com `-ss` na posição salva; fila e quem
  pediu ficam iguais. Faixa que não baixa mais segue o caminho de sempre
  (pula para a próxima com o aviso de falha que o Maestro já dá). Nenhum aviso
  novo no chat. Canal que já tem player (retomada repetida, ou alguém pediu
  música antes) fica como está.
- **Posição**: retoma de onde estava no SIGTERM, sem pular os segundos em que
  o servidor ficou fora (é o que a pessoa espera de "continuar"; o
  reinício leva poucos segundos). A barra do painel volta já andada.
- Fora do desligamento gracioso (queda), a posição é a da última mudança
  gravada (em geral o começo da faixa): a música volta, do início dela.
- Volume, pausa e loop não existem no Maestro hoje; o painel é o
  `music:state` da call (não há mensagem de painel no chat a reaproveitar).

## Consequências

- Deploy não para mais a música: alguns segundos de silêncio e o Maestro
  continua a mesma faixa.
- O badge DJ não conta de novo a faixa retomada depois dos 30 s.
- Mudar o formato da faixa (`Track`/`Item`) agora mexe no JSON salvo; campo
  novo precisa ser opcional.
- Teste ponta a ponta com LiveKit e ffmpeg de verdade:
  `TestLiveKitLocalMaestroResumesAfterRestart` (com `MUSIC_LIVEKIT_TEST_URL`
  e, para passar pelo Postgres, `TEST_DATABASE_URL`).
