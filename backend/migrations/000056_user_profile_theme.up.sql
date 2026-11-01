-- Tema do cartão de perfil: borda, fundo do corpo (cor ou degradê) e efeito.
-- Só acrescenta colunas com padrão: o binário anterior continua funcionando.
-- Os valores são conferidos no backend (internal/profiletheme).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_border TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS profile_border_colors TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_background TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS profile_background_colors TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_effect TEXT NOT NULL DEFAULT 'none';
