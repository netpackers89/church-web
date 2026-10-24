CREATE TABLE IF NOT EXISTS telegram_updates (
    id BIGSERIAL PRIMARY KEY,
    telegram_update_id BIGINT NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    processing_status VARCHAR(16) NOT NULL DEFAULT 'PROCESSING'
        CHECK (processing_status IN ('PROCESSING', 'PROCESSED', 'FAILED')),
    processed_at TIMESTAMPTZ,
    error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE telegram_updates
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS telegram_updates_status_updated_idx
    ON telegram_updates(processing_status, updated_at);

ALTER TABLE telegram_messages
    ADD COLUMN IF NOT EXISTS telegram_account_id BIGINT
        REFERENCES telegram_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS telegram_update_id BIGINT
        REFERENCES telegram_updates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS telegram_messages_account_id_idx
    ON telegram_messages(telegram_account_id)
    WHERE telegram_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS telegram_messages_update_id_idx
    ON telegram_messages(telegram_update_id)
    WHERE telegram_update_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_messages_chat_message_unique
    ON telegram_messages(chat_id, telegram_message_id)
    WHERE telegram_message_id IS NOT NULL;
