-- Perfis salvos (issue #344): a pessoa guarda o perfil inteiro com um nome e
-- troca entre eles com um clique. Avatar e banner vão por referência (a URL
-- da mídia que já está em profile/): o arquivo não é duplicado e só é apagado
-- quando nem o perfil nem nenhum perfil salvo usa mais (ADR 0011).
-- fields: os campos do perfil (user.ProfileInput) como estavam ao salvar.
CREATE TABLE IF NOT EXISTS saved_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    banner_url TEXT,
    fields JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nome único por pessoa, sem diferenciar maiúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_profiles_user_name ON saved_profiles (user_id, lower(name));
-- A limpeza da mídia pergunta "alguém ainda usa esta URL?".
CREATE INDEX IF NOT EXISTS idx_saved_profiles_avatar ON saved_profiles (avatar_url) WHERE avatar_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_profiles_banner ON saved_profiles (banner_url) WHERE banner_url IS NOT NULL;
