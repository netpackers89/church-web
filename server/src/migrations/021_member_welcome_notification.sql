CREATE UNIQUE INDEX IF NOT EXISTS user_member_welcome_notification_unique
    ON user_notifications (user_id, type)
    WHERE event_id IS NULL AND type = 'MEMBER_WELCOME';