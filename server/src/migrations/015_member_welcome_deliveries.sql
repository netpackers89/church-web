-- ============================================================================
-- Church Website — Migration 015: idempotent member welcome delivery outcomes
-- ============================================================================

CREATE TABLE IF NOT EXISTS member_welcome_deliveries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(16) NOT NULL CHECK (channel IN ('EMAIL', 'TELEGRAM')),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')),
    error_detail TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_member_welcome_deliveries_status
    ON member_welcome_deliveries (status, updated_at DESC);
