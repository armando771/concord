-- Apelido no servidor: muda só como o nome aparece naquele servidor (NULL =
-- sem apelido, vale o nome de exibição). Até 32 caracteres, sem espaços nas
-- pontas (o backend já manda arrumado).
ALTER TABLE server_members
    ADD COLUMN nickname VARCHAR(32) NULL CHECK (nickname IS NULL OR nickname <> '');

-- Permissões novas (backend/internal/permission/perms.go): CHANGE_NICKNAME
-- (1<<26 = 67108864) vem ligada para todo mundo, como no Discord, e o
-- Moderador criado com o servidor ganha também MANAGE_NICKNAMES (1<<27 =
-- 134217728). Juntas: 201326592. Servidores novos já nascem assim.
UPDATE roles SET permissions = permissions | 67108864 WHERE is_default;
UPDATE roles SET permissions = permissions | 201326592 WHERE name = 'Moderador' AND NOT is_default;
