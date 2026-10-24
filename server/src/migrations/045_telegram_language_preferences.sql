ALTER TABLE telegram_accounts
    ADD COLUMN IF NOT EXISTS language_code VARCHAR(2),
    ADD COLUMN IF NOT EXISTS pending_action VARCHAR(32);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'telegram_accounts_language_code_check'
          AND conrelid = 'telegram_accounts'::regclass
    ) THEN
        ALTER TABLE telegram_accounts
            ADD CONSTRAINT telegram_accounts_language_code_check
            CHECK (language_code IS NULL OR language_code IN ('en', 'am', 'om'));
    END IF;
END;
$$;
