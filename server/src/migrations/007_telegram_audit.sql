-- ============================================================================
-- Church Website — Migration 007: telegram_accounts + telegram_link_tokens +
--                            telegram_messages + trigger registration
-- ============================================================================

-- ----------------------------------------------------------------------------
-- telegram_accounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telegram_accounts (
    id BIGSERIAL PRIMARY KEY,
    telegram_user_id BIGINT UNIQUE NOT NULL,
    chat_id VARCHAR(100) NOT NULL,
    username VARCHAR(64),
    display_name VARCHAR(160),
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    linked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- telegram_link_tokens
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    telegram_user_id BIGINT,
    chat_id VARCHAR(100),
    username VARCHAR(64),
    display_name VARCHAR(160),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_tokens_user_id ON telegram_link_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_tokens_expires ON telegram_link_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_telegram_tokens_used ON telegram_link_tokens(used_at) WHERE used_at IS NULL;

-- ----------------------------------------------------------------------------
-- telegram_messages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telegram_messages (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    content_type VARCHAR(20),
    chat_id VARCHAR(100) NOT NULL,
    telegram_message_id INTEGER,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    handled_by BIGINT REFERENCES users(id),
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_status ON telegram_messages(status);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_received_at ON telegram_messages(received_at);

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
-- Keep media_items.updated_at fresh.  The canonical table is `media_items`
-- (not `media`).  Guarded so the migration is safe whether or not the trigger
-- already exists.
DROP TRIGGER IF EXISTS trg_media_items_updated ON media_items;
CREATE TRIGGER trg_media_items_updated
    BEFORE UPDATE ON media_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
