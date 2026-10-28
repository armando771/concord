# 0013. Mesa de áudio por servidor, com favoritos da pessoa valendo em qualquer servidor

- Status: aceito
- Data: 2026-10-28

## Contexto

Pedido: o som enviado à mesa de áudio é do servidor onde foi enviado; na
chamada de um servidor aparecem os sons dele e, à parte, os favoritos da
pessoa, que podem vir de outros servidores. Também: quem pode enviar som e
figurinha passa a ser configurável nos cargos.

O banco já guardava cada som com `server_id` (000019) e a listagem já era por
servidor. Os favoritos, porém, eram só um `localStorage` com ids, filtrados
contra a lista do servidor aberto: não atravessavam servidores nem aparelhos,
e o backend recusava tocar som de outro servidor. Enviar som pedia
`USE_SOUNDBOARD`; figurinha, só ser membro.

## Opções consideradas

1. **Copiar o som para o servidor ao favoritar.** Simples de tocar, mas
   duplica arquivo, ocupa a cota de 50 sons do servidor e quem apaga na origem
   não apaga a cópia.
2. **Favorito no `localStorage` + liberar tocar qualquer som.** Sem tabela,
   mas o backend não teria como saber se o som é favorito de quem toca.
3. **Tabela `soundboard_favorites (user_id, sound_id)`** com `ON DELETE
   CASCADE` nos dois lados. A chamada toca o som do servidor dela *ou* um
   favorito de quem toca.

## Decisão

Opção 3. Detalhes:

- Favoritar pede ser membro do servidor do som (é onde a pessoa o vê); usar
  depois não pede. Limite de 100 favoritos por pessoa.
- O "Usar mesa de áudio" checado é o do canal onde se está tocando, para som
  do servidor ou favorito.
- O arquivo do som (`/soundboard/:id/file`) passa a ser entregue a qualquer
  pessoa logada: quem está na chamada ouve o favorito de outro servidor sem
  ser de lá. O id é um UUID que só chega a quem vê o som na mesa ou o ouve.
- Chamada de DM continua sem mesa de áudio: o "Usar mesa de áudio" é
  permissão de canal de servidor e DM não tem onde configurá-la.
- Os favoritos antigos do `localStorage` são enviados ao servidor uma vez
  pelo app (o que falhar, como som já apagado, some) e saem do `localStorage`.
- Permissões novas de servidor (sem sobrescrita por canal): `ADD_SOUNDS`
  (1<<28) e `ADD_STICKERS` (1<<29), ligadas no @everyone dos servidores novos.
  A 000125 dá `ADD_SOUNDS` a todo cargo que tinha `USE_SOUNDBOARD` e
  `ADD_STICKERS` ao @everyone: ninguém perde o que já fazia. Enviar som deixa
  de depender de `USE_SOUNDBOARD` (como no Discord, criar e usar são coisas
  separadas). "Gerenciar mesa de áudio" segue sendo o de apagar dos outros.

## Consequências

- Apagar um som na origem tira dos favoritos de todo mundo (cascata); quem
  está em outro servidor vê sumir ao reabrir a mesa.
- Quem saiu do servidor de origem continua com os favoritos de lá.
- Um link de arquivo de som vazado toca para qualquer pessoa logada (é só um
  clipe de até 15 s que já é público para quem está nas chamadas).

## Fontes

- Discord: soundboard com sons por servidor, favoritos e sons de outros
  servidores para quem tem Nitro; permissões separadas "Create Expressions" e
  "Use Soundboard".
- Padrão do repo: tabelas de relação por usuário com `ON DELETE CASCADE`
  (reações, perfis salvos).
