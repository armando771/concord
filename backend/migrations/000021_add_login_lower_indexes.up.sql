-- Login por e-mail ou nome de usuário sem diferenciar maiúsculas/minúsculas
-- (WHERE lower(coluna) = lower($1)).
--
-- username só é UNIQUE com caixa exata, então em produção podem existir
-- "SHACO" e "shaco". O índice único em lower(username) só é criado se não
-- houver nenhum conflito; com conflito, cria um índice comum (a migration
-- não falha) e o login desempata preferindo a caixa exata.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users GROUP BY lower(username) HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'usernames que só diferem na caixa: índice lower(username) sem UNIQUE';
    CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (lower(username));
  END IF;
END
$$;

-- E-mail: só para a busca ficar rápida (sem UNIQUE, pelo mesmo motivo).
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
