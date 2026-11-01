-- Volta o contador por trigger de 000038 (cada reação conta). Os tiers
-- tirados pelo up não voltam.
ALTER TABLE user_badge_stats
    ADD COLUMN IF NOT EXISTS reactions_given BIGINT NOT NULL DEFAULT 0 CHECK (reactions_given >= 0);

INSERT INTO user_badge_stats (user_id, reactions_given)
SELECT user_id, COUNT(*) FROM message_reactions GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE SET reactions_given = EXCLUDED.reactions_given;

CREATE OR REPLACE FUNCTION badge_count_reaction() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO user_badge_stats (user_id, reactions_given) VALUES (NEW.user_id, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            reactions_given = user_badge_stats.reactions_given + 1,
            updated_at = NOW();
    ELSE
        UPDATE user_badge_stats
        SET reactions_given = GREATEST(reactions_given - 1, 0), updated_at = NOW()
        WHERE user_id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_reactions_badge_count ON message_reactions;
CREATE TRIGGER message_reactions_badge_count
AFTER INSERT OR DELETE ON message_reactions
FOR EACH ROW EXECUTE FUNCTION badge_count_reaction();

DROP INDEX IF EXISTS idx_message_reactions_user_message;
