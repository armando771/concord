-- Volta o nome da coluna. O contador e os tiers tirados pelo up não voltam.
ALTER TABLE user_badge_stats RENAME COLUMN songs_played TO songs_queued;
