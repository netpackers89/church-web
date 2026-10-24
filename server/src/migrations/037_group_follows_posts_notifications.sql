-- ============================================================================
-- Church Website — Migration 037: Group follows, posts, and notifications
-- ============================================================================
-- Additive migration. Creates tables for the community workspace feature:
--   group_follows        — members following departments / Bible study groups
--   group_posts          — posts / announcements published within a group
--   group_notification_preferences — per-user per-group channel preferences
--   group_notification_deliveries  — delivery tracking for queued notifications
-- ============================================================================

-- ---- group_follows ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_follows (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL,
  group_type VARCHAR(30) NOT NULL CHECK (group_type IN ('department', 'bible_study_group')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT group_follows_unique UNIQUE (user_id, group_id, group_type)
);

CREATE INDEX IF NOT EXISTS idx_group_follows_user ON group_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_group_follows_group ON group_follows(group_id, group_type);

-- ---- group_posts -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_posts (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL,
  group_type VARCHAR(30) NOT NULL CHECK (group_type IN ('department', 'bible_study_group')),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  published_by BIGINT NOT NULL REFERENCES users(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_group_posts_group ON group_posts(group_id, group_type, deleted_at);
CREATE INDEX IF NOT EXISTS idx_group_posts_published ON group_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_posts_deleted_at ON group_posts(deleted_at) WHERE deleted_at IS NOT NULL;

-- ---- group_notification_preferences ----------------------------------------
CREATE TABLE IF NOT EXISTS group_notification_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL,
  group_type VARCHAR(30) NOT NULL CHECK (group_type IN ('department', 'bible_study_group')),
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  telegram_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT group_notification_preferences_unique UNIQUE (user_id, group_id, group_type)
);

CREATE INDEX IF NOT EXISTS idx_group_notification_preferences_user ON group_notification_preferences(user_id);

-- ---- group_notification_deliveries -----------------------------------------
CREATE TABLE IF NOT EXISTS group_notification_deliveries (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'telegram', 'in_app')),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_notification_deliveries_post ON group_notification_deliveries(post_id);
CREATE INDEX IF NOT EXISTS idx_group_notification_deliveries_user ON group_notification_deliveries(user_id, channel);
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_notification_deliveries_unique
  ON group_notification_deliveries(post_id, user_id, channel);

-- ---- Triggers --------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_group_posts_updated ON group_posts;
CREATE TRIGGER trg_group_posts_updated
    BEFORE UPDATE ON group_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_group_follows_updated ON group_follows;
CREATE TRIGGER trg_group_follows_updated
    BEFORE UPDATE ON group_follows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_group_notification_preferences_updated ON group_notification_preferences;
CREATE TRIGGER trg_group_notification_preferences_updated
    BEFORE UPDATE ON group_notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();