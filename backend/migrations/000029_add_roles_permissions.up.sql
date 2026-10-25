-- Cargos e permissões no estilo Discord. permissions/allow/deny são bits
-- (backend/internal/permission/perms.go). Cada servidor tem um @everyone
-- (is_default, posição 0) que vale para todo membro; os demais cargos somam
-- por cima e a posição define a hierarquia (maior = mais alto).
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(32) NOT NULL,
    color INTEGER NULL CHECK (color IS NULL OR (color >= 0 AND color <= 16777215)),
    position INTEGER NOT NULL DEFAULT 0,
    permissions BIGINT NOT NULL DEFAULT 0,
    hoist BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roles_server ON roles (server_id);
CREATE UNIQUE INDEX idx_roles_one_default ON roles (server_id) WHERE is_default;

-- Cargos de cada membro (o @everyone é implícito, não entra aqui). Sair ou ser
-- expulso do servidor apaga junto.
CREATE TABLE member_roles (
    server_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (server_id, user_id, role_id),
    FOREIGN KEY (server_id, user_id) REFERENCES server_members(server_id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_member_roles_role ON member_roles (role_id);

-- Sobrescritas por canal: target é um cargo (target_type='role') ou um membro
-- ('member'). Canal privado = @everyone com deny de VIEW_CHANNEL.
CREATE TABLE channel_overwrites (
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('role', 'member')),
    target_id UUID NOT NULL,
    allow BIGINT NOT NULL DEFAULT 0,
    deny BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (channel_id, target_type, target_id)
);

CREATE TABLE server_bans (
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    reason VARCHAR(512) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (server_id, user_id)
);

-- Servidores que já existem: @everyone com o padrão (VIEW, SEND, ATTACH,
-- REACTIONS, HISTORY, INVITE, CONNECT, SPEAK, STREAM, SOUNDBOARD = 4663057) e
-- "Moderador" com o que o antigo role='admin' fazia (16727867).
INSERT INTO roles (server_id, name, position, permissions, is_default)
SELECT id, '@everyone', 0, 4663057, TRUE FROM servers;

INSERT INTO roles (server_id, name, position, permissions, hoist)
SELECT id, 'Moderador', 1, 16727867, TRUE FROM servers;

INSERT INTO member_roles (server_id, user_id, role_id)
SELECT sm.server_id, sm.user_id, r.id
FROM server_members sm
JOIN servers s ON s.id = sm.server_id
JOIN roles r ON r.server_id = sm.server_id AND r.name = 'Moderador' AND NOT r.is_default
WHERE sm.role = 'admin' AND sm.user_id <> s.owner_id;
