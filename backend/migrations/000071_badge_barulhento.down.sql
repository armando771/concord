DELETE FROM user_badges WHERE category = 'barulhento';
ALTER TABLE user_badge_stats DROP COLUMN IF EXISTS sounds_played;
