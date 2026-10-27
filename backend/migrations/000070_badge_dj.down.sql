DELETE FROM user_badges WHERE category = 'dj';
ALTER TABLE user_badge_stats DROP COLUMN IF EXISTS songs_queued;
