ALTER TABLE users
	ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(8) NOT NULL DEFAULT 'en',
	ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
	ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS email_change_tokens (
	id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	new_email VARCHAR(320) NOT NULL,
	token_hash CHAR(64) NOT NULL UNIQUE,
	expires_at TIMESTAMPTZ NOT NULL,
	used_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_change_tokens_user_idx ON email_change_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_change_tokens_expiry_idx ON email_change_tokens (expires_at) WHERE used_at IS NULL;