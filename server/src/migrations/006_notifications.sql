-- ============================================================================
-- Church Website — Migration 006: password_reset_requests + notifications
-- ============================================================================

-- ----------------------------------------------------------------------------
-- password_reset_requests
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_reset_state
        CHECK (
            (used_at IS NULL AND invalidated_at IS NULL AND expires_at > NOW())
            OR (used_at IS NOT NULL)
            OR (invalidated_at IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_requests(expires_at);

-- ----------------------------------------------------------------------------
-- announcements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    image_url TEXT,
    published_at TIMESTAMPTZ,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_deleted_at ON announcements(deleted_at) WHERE deleted_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- media library (sermons, banners, flyers, etc.)
-- ----------------------------------------------------------------------------
-- The canonical media table is `media_items` (created by an earlier migration
-- and referenced throughout the application).  A duplicate `media` table must
-- NOT be created here; doing so would leave an unused, divergent copy.  Only
-- the supporting index is ensured, keyed on the real table.
CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(type);
CREATE INDEX IF NOT EXISTS idx_media_items_deleted_at ON media_items(deleted_at) WHERE deleted_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- partners
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partners (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    website_url VARCHAR(500),
    logo_url TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_partners_deleted_at ON partners(deleted_at) WHERE deleted_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- contact_messages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(320) NOT NULL,
    phone VARCHAR(40),
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- system_settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL
);

-- ----------------------------------------------------------------------------
-- notification_templates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_templates (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    channel VARCHAR(20) NOT NULL,
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- user_notifications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id BIGINT REFERENCES events(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    link_url TEXT,
    email_status VARCHAR(20) NOT NULL DEFAULT 'SKIPPED',
    notification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    CONSTRAINT valid_notify_status CHECK (notification_status IN ('PENDING','SENT','FAILED','READ','SKIPPED'))
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_event_id ON user_notifications(event_id);
-- notification_status exists on fresh installs but was absent on some legacy
-- deployments that used a leaner user_notifications shape.  Guard the index so
-- this migration converges on both without failing.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_notifications'
          AND column_name = 'notification_status'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_user_notifications_notification_status
            ON user_notifications(notification_status);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notification_unique
    ON user_notifications (user_id, event_id, type);
