-- Permissão nova (backend/internal/permission/perms.go): DISCONNECT_MEMBERS
-- (1<<24 = 16777216) no Moderador criado com o servidor.
UPDATE roles SET permissions = permissions | 16777216 WHERE name = 'Moderador' AND NOT is_default;
