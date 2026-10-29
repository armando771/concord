-- Busca de mensagens (DMs e servidor). Trigramas (pg_trgm) sobre o texto sem
-- acento e em minúsculas, com LIKE '%termo%': acha pedaço de palavra ("jog"
-- acha "jogando"), gíria, abreviação, link e nick, que a busca por palavras
-- (tsvector 'portuguese') perde com stemming e stopwords, e destaca no app
-- exatamente o que casou. O índice GIN atende termos de 3+ letras; os mais
-- curtos ainda funcionam, varrendo só as mensagens dos canais da busca.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- unaccent() não é IMMUTABLE (depende do search_path e do dicionário), então
-- não entra num índice. Esta versão fixa o dicionário e o schema e pode.
-- O texto da busca passa pela mesma função, então "é" e "e" casam.
CREATE OR REPLACE FUNCTION search_normalize(input TEXT) RETURNS TEXT
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, input)) $$;

CREATE INDEX IF NOT EXISTS idx_messages_content_search
    ON messages USING gin (search_normalize(content) public.gin_trgm_ops);

