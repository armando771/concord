DELETE FROM user_badges WHERE category = 'sequencia';
ALTER TABLE user_badge_stats
    DROP COLUMN IF EXISTS active_last_day,
    DROP COLUMN IF EXISTS streak_days,
    DROP COLUMN IF EXISTS longest_streak_days;
