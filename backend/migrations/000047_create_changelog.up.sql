CREATE TABLE changelog_releases (
    id BIGSERIAL PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    summary TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_changelog_releases_released_at
    ON changelog_releases (released_at DESC, id DESC);

CREATE TABLE changelog_entries (
    id BIGSERIAL PRIMARY KEY,
    release_id BIGINT NOT NULL REFERENCES changelog_releases(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('feature', 'fix')),
    text TEXT NOT NULL,
    position INT NOT NULL
);

CREATE INDEX idx_changelog_entries_release
    ON changelog_entries (release_id, position);
