# 0009. Tratar o dono como nível interno, sem cargos padrão além do @everyone

- Status: aceito
- Data: 2026-10-27

## Contexto

As issues #331 e #332 pedem que o "Dono do servidor" deixe de parecer um cargo
e que acabem os cargos padrão. Hoje o servidor novo nasce com @everyone, Bots e
**Moderador**; a lista de membros tem um grupo "Dono do Servidor", o dono fica
âmbar e tem uma etiqueta "Dono"; e o app escondia do dono o "+" de dar cargo a
si mesmo. No cálculo de permissões o dono já era especial (`owner_id`: tudo,
acima da hierarquia, nunca alvo), então a mudança é mais de modelo e de
exibição que de regra.

Forças: servidores antigos usam o Moderador (não pode sumir); o cálculo precisa
continuar igual nos dois lados (vetores compartilhados); apps antigos ainda
podiam chamar `PUT /servers/:id/members/:userId/role` ("Tornar moderador").

## Opções consideradas

1. **Cargo "Dono" de sistema** (como o Bots), no topo e não editável. Prós: a
   lista agruparia sozinha. Contras: é exatamente o "cargo Dono" que a issue
   tira; daria para atribuir/tirar e mover, com casos especiais em todo lugar.
2. **Dono só pelo `owner_id`, como o Discord** (dono não é cargo; a coroa marca
   quem é). Prós: é o que o código de permissão já faz; some código em vez de
   nascer; o dono aparece com os cargos que tiver. Contras: o dono sem cargo
   fica no grupo "Membros".
3. **Manter o Moderador padrão e só mudar a exibição do dono.** Contras: a
   issue pede o fim dos cargos padrão.

## Decisão

Opção 2. O dono é um nível interno preso ao `owner_id`: tudo, acima de
qualquer cargo, nunca alvo, e os cargos dele só ele mexe (`CanEditRolesOf`,
nos vetores). O servidor novo nasce só com @everyone e Bots (Bots continua:
é o cargo de sistema dos bots, não um cargo de pessoa). Os Moderadores que já
existem ficam como cargos comuns — nunca tiveram flag no banco, então não há
migration. O atalho legado "Tornar moderador" (`SetModerator` e a rota
`PUT …/members/:userId/role`), que achava o cargo pelo nome, sai: o app atual
não usa e todos os apps instalados se atualizam a cada merge na `main`. No
app, o dono aparece agrupado e colorido pelo cargo, com uma coroa
("Dono do servidor") ao lado do nome.

## Consequências

- Fica fácil: menos caso especial (sem grupo, cor e etiqueta do dono; sem
  procurar cargo pelo nome).
- Um app muito antigo que ainda chame a rota legada recebe 404.
- O Administrador continua respeitando a hierarquia: com qualquer cargo, age
  sobre quem não tem cargo; dado só pelo @everyone, não age sobre outros sem
  cargo (mesma posição).
- Fica para depois: o cartão de perfil ainda usa o âmbar do dono no banner e
  no avatar sem foto (mudar exige quebrar o `UserProfileCard`, complexidade 86).

## Fontes

- Discord, "Role Management 101" (o dono não é um cargo, a coroa marca o dono):
  https://support.discord.com/hc/en-us/articles/214836687
- Discord Developer Docs, "Permissions — Permission Hierarchy":
  https://discord.com/developers/docs/topics/permissions#permission-hierarchy
