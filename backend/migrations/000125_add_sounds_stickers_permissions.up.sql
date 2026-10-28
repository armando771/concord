-- Permissões novas (backend/internal/permission/perms.go): ADD_SOUNDS
-- (1<<28 = 268435456) e ADD_STICKERS (1<<29 = 536870912). Ninguém perde o que
-- já fazia: enviar som pedia USE_SOUNDBOARD (1<<22 = 4194304) no servidor, então
-- todo cargo que a tem ganha ADD_SOUNDS; enviar figurinha só pedia ser membro,
-- então o @everyone (e o Moderador criado com o servidor) ganha ADD_STICKERS.
UPDATE roles SET permissions = permissions | 268435456 WHERE permissions & 4194304 <> 0;
UPDATE roles SET permissions = permissions | 536870912 WHERE is_default;
UPDATE roles SET permissions = permissions | 536870912 WHERE name = 'Moderador' AND NOT is_default;
