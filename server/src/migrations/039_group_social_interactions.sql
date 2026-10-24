-- Social interactions and publishing state for department / Bible study feeds.
ALTER TABLE group_posts
  ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'UPDATE',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_posts_status_check') THEN
    ALTER TABLE group_posts ADD CONSTRAINT group_posts_status_check
      CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_posts_category_check') THEN
    ALTER TABLE group_posts ADD CONSTRAINT group_posts_category_check
      CHECK (category IN ('UPDATE', 'ANNOUNCEMENT', 'DEVOTIONAL', 'STORY', 'EVENT'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_group_posts_feed
  ON group_posts(group_type, group_id, is_pinned DESC, published_at DESC)
  WHERE deleted_at IS NULL AND status = 'PUBLISHED';

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_posts_idempotency
  ON group_posts(group_type, group_id, published_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS group_post_likes (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT group_post_likes_unique UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_post_likes_post ON group_post_likes(post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS group_post_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id BIGINT REFERENCES group_post_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3000),
  edited_at TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  moderated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  moderation_note VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_post_comments_post
  ON group_post_comments(post_id, created_at ASC) WHERE deleted_at IS NULL AND hidden_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_group_post_comments_user ON group_post_comments(user_id, post_id);

DROP TRIGGER IF EXISTS trg_group_post_comments_updated ON group_post_comments;
CREATE TRIGGER trg_group_post_comments_updated
  BEFORE UPDATE ON group_post_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
