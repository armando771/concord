ALTER TABLE user_badge_stats DROP COLUMN IF EXISTS watch_seconds;
DELETE FROM user_badges WHERE category = 'espectador';
