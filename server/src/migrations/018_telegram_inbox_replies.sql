-- ============================================================================
-- Church Website — Migration 018: audited Telegram inbox replies
-- ============================================================================

CREATE TABLE IF NOT EXISTS telegram_message_replies (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_message_id BIGINT NOT NULL REFERENCES telegram_messages(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(80) NOT NULL UNIQUE,
    reply_text TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')),
    telegram_delivery_message_id BIGINT,
    error_detail TEXT,
    sent_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_telegram_replies_message
    ON telegram_message_replies (telegram_message_id, created_at);
