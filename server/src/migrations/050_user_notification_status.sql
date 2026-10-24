-- Older installations may have created user_notifications before its delivery
-- status column was added. CREATE TABLE IF NOT EXISTS does not upgrade them.
ALTER TABLE user_notifications
  ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

CREATE INDEX IF NOT EXISTS idx_user_notifications_notification_status
  ON user_notifications(notification_status);
