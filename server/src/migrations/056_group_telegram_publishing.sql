ALTER TABLE events
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_events_idempotency
  ON events(created_by, audience_group_type, audience_group_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND audience_group_type IS NOT NULL
    AND audience_group_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS group_telegram_deliveries (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL UNIQUE REFERENCES group_posts(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL,
  group_type VARCHAR(30) NOT NULL CHECK (group_type IN ('department', 'bible_study_group')),
  destination VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  telegram_message_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_telegram_deliveries_group
  ON group_telegram_deliveries(group_type, group_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS group_telegram_delivery_parts (
  post_id BIGINT NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
  part_index INTEGER NOT NULL CHECK (part_index >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT')),
  telegram_message_id BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, part_index)
);

CREATE TABLE IF NOT EXISTS group_telegram_test_deliveries (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL,
  group_type VARCHAR(30) NOT NULL CHECK (group_type IN ('department', 'bible_study_group')),
  requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  destination VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  telegram_message_id BIGINT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_telegram_test_deliveries_group
  ON group_telegram_test_deliveries(group_type, group_id, created_at DESC);
