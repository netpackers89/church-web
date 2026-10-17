-- Password recovery, campaign presentation, and durable member event notices.
-- This migration is additive: existing campaign, event, and account data stays intact.

CREATE TABLE IF NOT EXISTS password_reset_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_hash VARCHAR(100) NOT NULL,
    purpose VARCHAR(32) NOT NULL DEFAULT 'PASSWORD_RESET' CHECK (purpose = 'PASSWORD_RESET'),
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    verification_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (verification_attempts >= 0 AND verification_attempts <= 5),
    reset_token_hash CHAR(64),
    reset_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS password_reset_active_user_idx
    ON password_reset_requests(user_id, created_at DESC)
    WHERE used_at IS NULL AND invalidated_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_token_unique
    ON password_reset_requests(reset_token_hash) WHERE reset_token_hash IS NOT NULL;

ALTER TABLE fundraising_campaigns
    ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES donation_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS banner_url TEXT,
    ADD COLUMN IF NOT EXISTS cta_url TEXT;
CREATE INDEX IF NOT EXISTS fundraising_campaigns_public_idx
    ON fundraising_campaigns(status, starts_at, ends_at) WHERE status IN ('ACTIVE', 'CLOSED');

ALTER TABLE daily_verse_publications
    ADD COLUMN IF NOT EXISTS background_image_url TEXT;

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS audience_department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS notify_members BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS notify_all_members BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    link_url TEXT,
    email_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (email_status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS user_event_notification_unique
    ON user_notifications(user_id, event_id, type) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON user_notifications(user_id, created_at DESC);
