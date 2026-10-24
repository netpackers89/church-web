ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_marital_status_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_marital_status_check
      CHECK (marital_status IS NULL OR marital_status IN ('Single', 'Married', 'Rather not say'));
  END IF;
END;
$$;
