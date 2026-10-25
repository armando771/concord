-- Silenciar notificações como no Discord: por servidor e por canal, por
-- pessoa. muted_until NULL com muted = true é "até eu reativar". O padrão
-- (tudo, sem mute) não ocupa linha.
CREATE TABLE server_notification_settings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    muted BOOLEAN NOT NULL DEFAULT FALSE,
    muted_until TIMESTAMPTZ,
    level TEXT NOT NULL DEFAULT 'all' CHECK (level IN ('all', 'mentions', 'nothing')),
    suppress_everyone BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, server_id)
);

CREATE INDEX idx_server_notification_settings_server ON server_notification_settings (server_id);

CREATE TABLE channel_notification_settings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    muted BOOLEAN NOT NULL DEFAULT FALSE,
    muted_until TIMESTAMPTZ,
    level TEXT NOT NULL DEFAULT 'all' CHECK (level IN ('all', 'mentions', 'nothing')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, channel_id)
);

CREATE INDEX idx_channel_notification_settings_channel ON channel_notification_settings (channel_id);
