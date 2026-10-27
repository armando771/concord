DELETE FROM user_badges WHERE category = 'camera';
ALTER TABLE user_badge_stats DROP COLUMN IF EXISTS camera_seconds;
