ALTER TABLE users
  DROP COLUMN IF EXISTS profile_border,
  DROP COLUMN IF EXISTS profile_border_colors,
  DROP COLUMN IF EXISTS profile_background,
  DROP COLUMN IF EXISTS profile_background_colors,
  DROP COLUMN IF EXISTS profile_effect;
