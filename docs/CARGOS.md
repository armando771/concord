# Cargos e permissões

Cada servidor tem **cargos** com permissões, como no Discord. O **dono** (quem criou) sempre pode tudo e nunca é alvo de expulsão, banimento ou silêncio.

## Como as permissões são calculadas

1. Todo membro tem o cargo **@everyone** (posição 0, não se apaga nem renomeia).
2. Soma-se (OU) as permissões de cada cargo que o membro tem.
3. Quem tem **Administrador** (e o dono) fica com tudo e ignora as regras dos canais.
4. Em cada canal, as **sobrescritas** são aplicadas nesta ordem — em cada etapa, *negar* tira e *permitir* põe:
   1. a do @everyone;
   2. as dos cargos do membro (somadas: se um cargo permite, vale);
   3. a do próprio membro (vence tudo).
5. Sem **Ver canais** o resultado é zero: o canal nem aparece. Em texto, sem *Enviar mensagens* caem *Enviar arquivos* e *Mencionar @all*. Em voz, sem *Conectar* caem falar, transmitir, mesa de áudio e moderação.

O cálculo é o mesmo no backend (`backend/internal/permission`) e no app (`frontend/src/renderer/src/features/servers/lib/permissions.ts`). Os dois rodam os mesmos casos de `backend/internal/permission/testdata/vectors.json`: mudou uma regra, mude os casos e os dois lados.

## Permissões

| Grupo | Permissão | Efeito |
|---|---|---|
| Geral | Ver canais | Vê o canal (sem isso ele é invisível). |
| | Gerenciar canais | Criar, editar, reordenar e apagar canais. |
| | Gerenciar cargos | Criar/editar cargos abaixo do seu, dar e tirar cargos, editar permissões de canal. |
| | Gerenciar servidor | Nome, ícone e canal principal. |
| | Criar convite | Convidar amigos e ver o código do servidor. |
| | Gerenciar mesa de áudio | Apagar áudios de outras pessoas. |
| Membros | Expulsar / Banir | Tirar o membro (o ban impede de voltar até desbanir). |
| | Administrador | Tudo, ignorando os canais. |
| Texto | Enviar mensagens, Enviar arquivos, Adicionar reações, Ver histórico | Uso normal do chat. |
| | Mencionar @all e @here | Avisar o canal inteiro. |
| | Gerenciar mensagens | Apagar mensagem de outros e encerrar enquetes. |
| Voz | Conectar, Falar, Transmitir | Entrar, usar o microfone, compartilhar tela/câmera. |
| | Usar mesa de áudio | Tocar e enviar áudios. |
| | Silenciar / Ensurdecer / Mover membros | Moderação na chamada (mover inclui desconectar). |

Padrões de um servidor novo: **@everyone** (ver, escrever, anexar, reagir, histórico, convidar, conectar, falar, transmitir, mesa de áudio) e um cargo **Moderador** (o que o antigo "admin" fazia: canais, servidor, @all, apagar mensagens, mover/silenciar/ensurdecer, expulsar, gerenciar mesa de áudio — sem gerenciar cargos nem banir).

## Hierarquia

A posição do cargo define quem manda em quem (maior = mais alto).

- Só se edita, dá ou tira um cargo que esteja **abaixo do seu cargo mais alto** (o dono, qualquer um).
- Expulsar, banir, silenciar, ensurdecer, desconectar e mover só vale sobre quem tem o cargo mais alto **menor** que o seu. Mesma posição não vale.
- Ninguém dá ou tira uma permissão que **não tem** (Administrador pode tudo).

## Canais privados

*Canal privado* é o canal em que o @everyone não tem **Ver canais**. Quem vê é quem tem um cargo (ou o próprio nome) liberado na aba **Permissões** do canal. O servidor não manda o canal, as mensagens nem os eventos de tempo real para quem não vê, e tira da sala quem perde o acesso na hora (cargo tirado, canal virou privado, expulsão).

## Voz

- Entrar exige **Conectar**; o token do LiveKit só deixa publicar o microfone com **Falar** e tela/câmera com **Transmitir**.
- *Silenciar* e *Ensurdecer no servidor* tiram do LiveKit a permissão de publicar / de ouvir e valem até um moderador liberar ou a chamada acabar.
- Mudou um cargo ou canal no meio da chamada? Quem perdeu o acesso sai da chamada e quem perdeu falar/transmitir tem a mídia ajustada na hora.

## API (resumo)

| Rota | Permissão |
|---|---|
| `GET/POST /servers/:id/roles`, `PATCH/DELETE …/roles/:roleId`, `PUT …/roles/order` | membro / Gerenciar cargos |
| `PUT/DELETE /servers/:id/members/:userId/roles/:roleId` | Gerenciar cargos (cargo abaixo do seu) |
| `PUT /servers/:id/members/:userId/role` | compatibilidade com apps antigos: põe/tira o cargo Moderador |
| `PUT/DELETE /servers/:id/channels/:channelId/overwrites/:role\|member/:targetId` | Gerenciar cargos no canal |
| `POST /servers/:id/channels` com `private` e `role_ids` | Gerenciar canais |
| `DELETE /servers/:id/members/:userId`, `POST /servers/:id/leave` | Expulsar / o próprio membro |
| `GET/POST /servers/:id/bans`, `DELETE …/bans/:userId` | Banir |
| `POST /calls/:id/participants/:userId/server-mute`, `…/server-deafen`, `DELETE …/participants/:userId` | Silenciar / Ensurdecer / Mover |

Erros de permissão vêm com `code` (`missing_permission`, `role_hierarchy`, `cannot_grant`, `banned`, `not_member`…) e o app os traduz.

## Eventos em tempo real

`role:create|update|delete|reorder`, `server:member:roles`, `server:permissions:invalidate` (o app relê canais, cargos e membros), `server:removed` (`reason`: `leave`, `kick` ou `ban`). `message:create/delete`, `channel:create/update` e `call:*` de canais só chegam a quem vê o canal.
