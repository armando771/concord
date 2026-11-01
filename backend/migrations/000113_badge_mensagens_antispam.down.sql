-- Volta o trigger de 000038 (toda mensagem conta, apagar não desconta). O
-- contador e os tiers tirados pelo up não voltam.
DROP TRIGGER IF EXISTS messages_badge_uncount ON messages;
DROP FUNCTION IF EXISTS badge_uncount_message();

CREATE OR REPLACE FUNCTION badge_count_message() RETURNS trigger AS $$
BEGIN
    IF NEW.system_kind IS NULL THEN
        INSERT INTO user_badge_stats (user_id, messages_sent) VALUES (NEW.author_id, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            messages_sent = user_badge_stats.messages_sent + 1,
            updated_at = NOW();
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_badge_count ON messages;
CREATE TRIGGER messages_badge_count
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION badge_count_message();

DROP FUNCTION IF EXISTS badge_message_repeats(messages);
DROP FUNCTION IF EXISTS badge_message_previous(messages);
DROP FUNCTION IF EXISTS badge_message_signature(messages);
DROP INDEX IF EXISTS idx_messages_author_created;
