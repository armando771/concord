-- Opções finas do tema do cartão de perfil (cor, quantidade e velocidade do
-- efeito, animação e espessura da borda, ângulo do degradê, textura).
-- Um JSONB só, com padrão vazio: o binário anterior continua funcionando e
-- '{}' vale o padrão de tudo (internal/profiletheme/extras.go).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_theme_extras JSONB NOT NULL DEFAULT '{}'::jsonb;
