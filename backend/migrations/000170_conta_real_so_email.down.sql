CREATE OR REPLACE FUNCTION server_level_real(p_user UUID) RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = p_user
          AND NOT u.is_bot
          AND u.email_verified_at IS NOT NULL
          AND u.created_at <= NOW() - INTERVAL '24 hours'
    )
$$ LANGUAGE sql STABLE;
