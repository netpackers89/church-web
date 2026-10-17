-- ============================================================================
-- Church Website — Migration 016: prevent multiple follow-ups linking to one account
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_new_christian_followups_linked_user
    ON new_christian_followups (linked_user_id)
    WHERE linked_user_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'new_christian_followups_linked_user_fk'
          AND conrelid = 'new_christian_followups'::regclass
    ) THEN
        ALTER TABLE new_christian_followups
            ADD CONSTRAINT new_christian_followups_linked_user_fk
            FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
