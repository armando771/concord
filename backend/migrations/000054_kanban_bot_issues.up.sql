-- Quadro de propostas: quem do time está com o card e o que já foi aplicado na
-- issue do GitHub (a issue acompanha o card: fecha, reabre e ganha assignee).
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS assignee_id UUID NULL REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NULL;
-- Estado já aplicado na issue: 'open', 'closed:completed' ou 'closed:not_planned'.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS github_issue_state TEXT NULL;
-- Login já aplicado como assignee da issue (NULL = sem assignee).
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS github_assignee TEXT NULL;

-- As issues que já existem foram abertas assim: só as que divergem são mexidas.
UPDATE proposals SET github_issue_state = 'open'
WHERE github_issue_number IS NOT NULL AND github_issue_state IS NULL;

-- Usuário do GitHub de quem é do time tech (vira o assignee da issue).
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT NULL;

-- Salinha Bot: manda na DM de quem sugeriu o andamento do card. Como o Maestro,
-- senha '!' nunca bate com bcrypt (não faz login); diferente dele, não entra em
-- servidor nenhum. Se "salinha-bot" já for de alguém, usa "salinha-bot-oficial".
INSERT INTO users (id, username, display_name, email, password_hash, is_bot, bio)
SELECT
    '53414c49-4e48-4100-8000-000000000002',
    CASE WHEN EXISTS (SELECT 1 FROM users WHERE LOWER(username) = 'salinha-bot')
         THEN 'salinha-bot-oficial' ELSE 'salinha-bot' END,
    'Salinha Bot',
    'salinha-bot@concord.invalid',
    '!',
    TRUE,
    'Te conto como anda a sua sugestão no quadro de propostas.'
ON CONFLICT (id) DO NOTHING;
