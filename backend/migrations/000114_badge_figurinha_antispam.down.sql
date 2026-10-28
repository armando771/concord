-- Volta a contagem de 000072 (toda figurinha conta, apagar não desconta). O
-- contador e os tiers tirados pelo up não voltam.
DROP TRIGGER IF EXISTS messages_badge_uncount_sticker ON messages;
DROP FUNCTION IF EXISTS badge_uncount_sticker();

CREATE OR REPLACE FUNCTION badge_count_sticker() RETURNS trigger AS $$
BEGIN
    INSERT INTO user_badge_stats (user_id, stickers_sent) VALUES (NEW.author_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        stickers_sent = user_badge_stats.stickers_sent + 1,
        updated_at = NOW();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS badge_sticker_repeats(messages);
