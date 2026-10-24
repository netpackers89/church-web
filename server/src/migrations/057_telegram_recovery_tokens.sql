CREATE TABLE IF NOT EXISTS telegram_recovery_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_recovery_tokens_lookup_idx
  ON telegram_recovery_tokens (token_hash, expires_at)
  WHERE used_at IS NULL;
