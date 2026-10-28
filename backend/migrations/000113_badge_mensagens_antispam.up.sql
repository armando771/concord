-- Badge "Mensagens enviadas" (internal/badge, categoria "mensagens"): spam não
-- conta mais.
--   - Mensagem igual à anterior da pessoa na mesma sala (canal ou DM), mandada
--     menos de 1 hora antes, não conta. "Igual" compara o texto normalizado
--     (sem espaços nas pontas, sem diferença de maiúsculas e com os espaços
--     seguidos virando um), a figurinha, o GIF e os anexos (tipo, nome e
--     tamanho, na ordem): com anexo diferente não é igual.
--   - Mensagem apagada até 2 minutos depois de enviada desconta, se tinha
--     contado. Apagada depois disso continua contando.
-- A contagem vira um trigger adiado para o fim da transação: os anexos são
-- ligados à mensagem depois do INSERT, na mesma transação.

-- A mensagem anterior da pessoa na sala é achada por este índice.
CREATE INDEX IF NOT EXISTS idx_messages_author_created ON messages (author_id, created_at DESC);

-- O que a mensagem mostra, para comparar repetições.
CREATE OR REPLACE FUNCTION badge_message_signature(m messages) RETURNS text AS $$
    SELECT lower(regexp_replace(btrim(m.content), '\s+', ' ', 'g'))
        || E'\x1f' || COALESCE(m.sticker_id::text, '')
        || E'\x1f' || COALESCE(m.gif_url, '')
        || E'\x1f' || COALESCE((
            SELECT string_agg(a.kind || ':' || a.size_bytes || ':' || a.filename, E'\x1e' ORDER BY a.position, a.id)
            FROM message_attachments a WHERE a.message_id = m.id
        ), '')
$$ LANGUAGE sql STABLE;

-- A mensagem anterior da pessoa na mesma sala, se veio há menos de 1 hora.
CREATE OR REPLACE FUNCTION badge_message_previous(m messages) RETURNS SETOF messages AS $$
    SELECT p.* FROM messages p
    WHERE p.author_id = m.author_id
      AND p.channel_id IS NOT DISTINCT FROM m.channel_id
      AND p.conversation_id IS NOT DISTINCT FROM m.conversation_id
      AND p.system_kind IS NULL
      AND p.created_at > m.created_at - INTERVAL '1 hour'
      AND (p.created_at, p.id) < (m.created_at, m.id)
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 1
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION badge_message_repeats(m messages) RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM badge_message_previous(m) p
        WHERE badge_message_signature(p) = badge_message_signature(m)
    )
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION badge_count_message() RETURNS trigger AS $$
BEGIN
    IF NOT badge_message_repeats(NEW) THEN
        INSERT INTO user_badge_stats (user_id, messages_sent) VALUES (NEW.author_id, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            messages_sent = user_badge_stats.messages_sent + 1,
            updated_at = NOW();
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_badge_count ON messages;
CREATE CONSTRAINT TRIGGER messages_badge_count
AFTER INSERT ON messages
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (NEW.system_kind IS NULL)
EXECUTE FUNCTION badge_count_message();

-- BEFORE: os anexos (que vão junto, por cascata) ainda estão lá para a
-- comparação. O WHEN deixa de fora, sem custo, o que já passou dos 2 minutos.
CREATE OR REPLACE FUNCTION badge_uncount_message() RETURNS trigger AS $$
BEGIN
    IF NOT badge_message_repeats(OLD) THEN
        UPDATE user_badge_stats
        SET messages_sent = GREATEST(messages_sent - 1, 0), updated_at = NOW()
        WHERE user_id = OLD.author_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_badge_uncount ON messages;
CREATE TRIGGER messages_badge_uncount
BEFORE DELETE ON messages
FOR EACH ROW
WHEN (OLD.system_kind IS NULL AND OLD.created_at > NOW() - INTERVAL '2 minutes')
EXECUTE FUNCTION badge_uncount_message();

-- Retroativo (só nesta correção, só nesta categoria). Mensagem apagada some
-- do banco (DELETE de verdade), então não dá para saber quais foram apagadas
-- em até 2 minutos: a conta nova usa só as que ainda existem, descontando as
-- repetições seguidas como o trigger, e o contador nunca sobe (LEAST).
WITH ordenadas AS (
    SELECT m.author_id, m.created_at,
           badge_message_signature(m) AS sig,
           LAG(badge_message_signature(m)) OVER w AS sig_antes,
           LAG(m.created_at) OVER w AS at_antes
    FROM messages m
    WHERE m.system_kind IS NULL
    WINDOW w AS (PARTITION BY m.author_id, m.channel_id, m.conversation_id ORDER BY m.created_at, m.id)
),
valor AS (
    SELECT author_id AS user_id,
           COUNT(*) FILTER (WHERE at_antes IS NULL OR at_antes <= created_at - INTERVAL '1 hour' OR sig_antes <> sig) AS n
    FROM ordenadas
    GROUP BY author_id
)
UPDATE user_badge_stats b
SET messages_sent = LEAST(b.messages_sent, COALESCE(v.n, 0)), updated_at = NOW()
FROM user_badge_stats s
LEFT JOIN valor v ON v.user_id = s.user_id
WHERE s.user_id = b.user_id AND b.messages_sent > 0;

-- Quem tem tier gravado acima do que a conta nova dá perde os tiers a mais,
-- como em 000095. Nada é concedido aqui (sem aviso de desbloqueio). Mesmos
-- limites de catalog_base.go.
WITH direito AS (
    SELECT g.user_id, COALESCE(MAX(t.tier), 0) AS tier
    FROM (SELECT DISTINCT user_id FROM user_badges WHERE category = 'mensagens') g
    LEFT JOIN user_badge_stats s ON s.user_id = g.user_id
    LEFT JOIN (VALUES (1, 50), (2, 500), (3, 2000), (4, 10000), (5, 50000)) AS t (tier, threshold)
        ON COALESCE(s.messages_sent, 0) >= t.threshold
    GROUP BY g.user_id
)
DELETE FROM user_badges b
USING direito d
WHERE b.category = 'mensagens' AND b.user_id = d.user_id AND b.tier > d.tier;
