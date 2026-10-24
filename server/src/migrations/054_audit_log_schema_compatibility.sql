ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS before_data JSONB,
    ADD COLUMN IF NOT EXISTS after_data JSONB;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
            AND table_name = 'audit_logs'
            AND column_name = 'before'
    ) THEN
        EXECUTE 'UPDATE audit_logs SET before_data = COALESCE(before_data, "before")';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
            AND table_name = 'audit_logs'
            AND column_name = 'after'
    ) THEN
        EXECUTE 'UPDATE audit_logs SET after_data = COALESCE(after_data, "after")';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
    ON audit_logs(actor_user_id, created_at DESC);
