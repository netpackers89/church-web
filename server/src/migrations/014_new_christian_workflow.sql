-- ============================================================================
-- Church Website — Migration 014: secure new-Christian follow-up workflow
-- ============================================================================

ALTER TABLE new_christian_followups
    ADD COLUMN IF NOT EXISTS assigned_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS linked_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS link_secret_hash CHAR(64),
    ADD COLUMN IF NOT EXISTS email_delivery_status VARCHAR(20) NOT NULL DEFAULT 'NOT_ATTEMPTED',
    ADD COLUMN IF NOT EXISTS email_delivery_error TEXT,
    ADD COLUMN IF NOT EXISTS telegram_delivery_status VARCHAR(20) NOT NULL DEFAULT 'NOT_CONNECTED',
    ADD COLUMN IF NOT EXISTS telegram_delivery_error TEXT,
    ADD COLUMN IF NOT EXISTS telegram_connected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_new_christian_followups_assigned
    ON new_christian_followups (assigned_to_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS new_christian_followup_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    followup_id BIGINT NOT NULL REFERENCES new_christian_followups(id) ON DELETE CASCADE,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_new_christian_followup_history_record
    ON new_christian_followup_history (followup_id, created_at DESC);

CREATE TABLE IF NOT EXISTS new_christian_telegram_link_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    followup_id BIGINT NOT NULL REFERENCES new_christian_followups(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_new_christian_telegram_link_expiry
    ON new_christian_telegram_link_tokens (expires_at, used_at);

ALTER TABLE telegram_accounts
    ADD COLUMN IF NOT EXISTS followup_id BIGINT REFERENCES new_christian_followups(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_accounts_followup
    ON telegram_accounts (followup_id) WHERE followup_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'telegram_accounts_single_owner_check'
          AND conrelid = 'telegram_accounts'::regclass
    ) THEN
        ALTER TABLE telegram_accounts
            ADD CONSTRAINT telegram_accounts_single_owner_check
            CHECK (user_id IS NULL OR followup_id IS NULL);
    END IF;
END $$;
