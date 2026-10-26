UPDATE roles SET permissions = permissions & ~16777216 WHERE name = 'Moderador' AND NOT is_default;
