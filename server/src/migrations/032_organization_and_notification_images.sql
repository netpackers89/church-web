-- Add image references without changing any existing records. Files remain in
-- the configured media provider; PostgreSQL stores only their public URL.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE user_notifications
  ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_user_notifications_unread
  ON user_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE notification_batches
  DROP CONSTRAINT IF EXISTS notification_batches_audience_check;
ALTER TABLE notification_batches
  ADD CONSTRAINT notification_batches_audience_check
  CHECK (audience_type IN ('USER', 'USERS', 'DEPARTMENT', 'ORGANIZATION', 'BIBLE_STUDY_GROUP', 'ROLE', 'ALL'));
