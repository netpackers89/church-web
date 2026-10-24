ALTER TABLE telegram_messages
    ADD COLUMN IF NOT EXISTS contact_submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS telegram_messages_contact_submission_idx
    ON telegram_messages(chat_id, contact_submitted_at DESC)
    WHERE contact_submitted_at IS NOT NULL;
