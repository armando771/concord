-- Última troca do nome de usuário (Minha conta): uma a cada 7 dias. Nula =
-- nunca trocou (o cadastro não conta).
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;
