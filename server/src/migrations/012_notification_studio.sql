-- ============================================================================
-- Church Website — Migration 012: Notification Studio
-- Session-authenticated, RBAC-gated broadcast dispatch with in-app fan-out,
-- real delivery logging, and duplicate-send prevention.
--
-- Additive only. Reuses the existing notification_deliveries and
-- notification_templates tables; adds a dispatch "batch" record and the few
-- columns the template gallery needs. No existing table or column is dropped.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- notification_batches — one row per dispatch action (test or live).
-- Records who acted, the selected audience, channels, and rolled-up counts so
-- the studio can show dispatch history and prevent accidental duplicate sends.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_batches (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    mode VARCHAR(10) NOT NULL DEFAULT 'LIVE',
    template_id BIGINT REFERENCES notification_templates(id) ON DELETE SET NULL,
    title VARCHAR(200),
    subject VARCHAR(200),
    body TEXT NOT NULL,
    link_url TEXT,
    audience_type VARCHAR(20) NOT NULL,
    audience_ref VARCHAR(120),
    channels TEXT[] NOT NULL DEFAULT '{}',
    recipient_count INTEGER NOT NULL DEFAULT 0,
    in_app_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    idempotency_key VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT notification_batches_mode_check CHECK (mode IN ('TEST', 'LIVE')),
    CONSTRAINT notification_batches_audience_check
        CHECK (audience_type IN ('USER', 'USERS', 'DEPARTMENT', 'ROLE', 'ALL'))
);

-- A batch is only idempotent when the caller supplied a key; otherwise many
-- keyless batches may coexist (NULLs are distinct in a unique index).
CREATE UNIQUE INDEX IF NOT EXISTS notification_batches_idempotency_unique
    ON notification_batches (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_batches_actor_idx
    ON notification_batches (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_batches_created_idx
    ON notification_batches (created_at DESC);

-- ----------------------------------------------------------------------------
-- notification_deliveries — link each delivery attempt back to its batch.
-- The table already carries channel/status/provider_message_id/attempts/
-- last_error, which is exactly the real delivery logging the brief requires.
-- ----------------------------------------------------------------------------
ALTER TABLE notification_deliveries
    ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES notification_batches(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS notification_deliveries_batch_idx
    ON notification_deliveries (batch_id);

-- ----------------------------------------------------------------------------
-- notification_templates — additive gallery metadata.
-- Editable subject/title/body already exist; add category, display title,
-- optional banner, and archival so admins can manage templates without code.
-- ----------------------------------------------------------------------------
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS category VARCHAR(40);
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS greeting VARCHAR(200);
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS signature VARCHAR(200);
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS notification_templates_category_idx
    ON notification_templates (category);
