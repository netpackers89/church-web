-- Track the initial follow welcome separately from post notifications.
ALTER TABLE group_notification_deliveries
  ALTER COLUMN post_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS group_id BIGINT,
  ADD COLUMN IF NOT EXISTS group_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS notification_type VARCHAR(40) NOT NULL DEFAULT 'GROUP_POST';

ALTER TABLE group_notification_deliveries
  DROP CONSTRAINT IF EXISTS group_notification_deliveries_channel_check;
ALTER TABLE group_notification_deliveries
  ADD CONSTRAINT group_notification_deliveries_channel_check CHECK (channel IN ('email', 'telegram', 'in_app'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_notification_follow_welcome_unique
  ON group_notification_deliveries(user_id, group_id, group_type, channel)
  WHERE notification_type = 'GROUP_FOLLOW_WELCOME';
