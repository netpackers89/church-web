-- ==============================================================================
-- Church Website - Migration 025: Account activation tokens (secure staff invitations)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS account_activation_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_activation_tokens_user_id ON account_activation_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_account_activation_tokens_expires ON account_activation_tokens(expires_at);

