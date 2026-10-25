ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

-- Maestro, o bot de música. Senha '!' nunca bate com bcrypt: não faz login.
-- Se "maestro" já for de alguém, usa "maestro-bot".
INSERT INTO users (id, username, display_name, email, password_hash, is_bot)
SELECT
    '4d414553-5452-4f00-8000-000000000001',
    CASE WHEN EXISTS (SELECT 1 FROM users WHERE LOWER(username) = 'maestro')
         THEN 'maestro-bot' ELSE 'maestro' END,
    'Maestro',
    'music-bot@concord.invalid',
    '!',
    TRUE
ON CONFLICT (id) DO NOTHING;

INSERT INTO server_members (server_id, user_id, role)
SELECT id, '4d414553-5452-4f00-8000-000000000001', 'member' FROM servers
ON CONFLICT DO NOTHING;
