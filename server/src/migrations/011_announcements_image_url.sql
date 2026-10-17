-- ==========================================================================
-- Church Website — Migration 011: announcement image support
-- --------------------------------------------------------------------------
-- Public announcements already support image metadata in the UI and media
-- library, but older deployments lacked the actual database column. Add the
-- field in a non-destructive, idempotent way so published announcements can
-- display campaign or event imagery without introducing a parallel table.
-- ==========================================================================

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_announcements_image_url
    ON announcements(image_url)
    WHERE image_url IS NOT NULL;
