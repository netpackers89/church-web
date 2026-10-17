
-- ==============================================================================
-- Church Website - Migration 023: Department & Bible study group
-- registration fields (additive + idempotent)
-- ==============================================================================

-- ---- departments: add fields required by the public registration form ----
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS leader_phone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS telegram_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(64),
  ADD COLUMN IF NOT EXISTS telegram_public_link VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS telegram_invite_link VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS telegram_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_verify_error TEXT,
  ADD COLUMN IF NOT EXISTS telegram_connection_status VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_telegram_type') THEN
    CREATE TYPE department_telegram_type AS ENUM ('group', 'channel', 'none');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_connection_status') THEN
    CREATE TYPE department_connection_status AS ENUM ('UNVERIFIED', 'PENDING', 'CONNECTED', 'ERROR');
  END IF;
END $$;

ALTER TABLE departments
  ALTER COLUMN telegram_type TYPE department_telegram_type USING
    CASE telegram_type WHEN 'group' THEN 'group'::department_telegram_type
                       WHEN 'channel' THEN 'channel'::department_telegram_type
                       ELSE 'none'::department_telegram_type END,
  ALTER COLUMN telegram_connection_status TYPE department_connection_status USING
    CASE telegram_connection_status WHEN 'UNVERIFIED' THEN 'UNVERIFIED'::department_connection_status
                                    WHEN 'PENDING' THEN 'PENDING'::department_connection_status
                                    WHEN 'CONNECTED' THEN 'CONNECTED'::department_connection_status
                                    WHEN 'ERROR' THEN 'ERROR'::department_connection_status
                                    ELSE 'UNVERIFIED'::department_connection_status END,
  ALTER COLUMN telegram_type SET NOT NULL,
  ALTER COLUMN telegram_connection_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_category_check') THEN
    ALTER TABLE departments ADD CONSTRAINT departments_category_check
      CHECK (category IS NULL OR char_length(trim(category)) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_telegram_type_check') THEN
    ALTER TABLE departments ADD CONSTRAINT departments_telegram_type_check
      CHECK (telegram_type IN ('group','channel','none'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_telegram_connection_status_check') THEN
    ALTER TABLE departments ADD CONSTRAINT departments_telegram_connection_status_check
      CHECK (telegram_connection_status IN ('UNVERIFIED','PENDING','CONNECTED','ERROR'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_departments_telegram_status
  ON departments(telegram_connection_status)
  WHERE telegram_connection_status <> 'UNVERIFIED';

-- ---- bible_study_groups: add fields required by the public registration form ----
ALTER TABLE bible_study_groups
  ADD COLUMN IF NOT EXISTS group_email VARCHAR(320),
  ADD COLUMN IF NOT EXISTS location_text VARCHAR(500),
  ADD COLUMN IF NOT EXISTS google_maps_link VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS current_study TEXT,
  ADD COLUMN IF NOT EXISTS group_profile_image TEXT,
  ADD COLUMN IF NOT EXISTS banner_image TEXT,
  ADD COLUMN IF NOT EXISTS leader_phone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS telegram_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(64),
  ADD COLUMN IF NOT EXISTS telegram_public_link VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS telegram_invite_link VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS telegram_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_verify_error TEXT,
  ADD COLUMN IF NOT EXISTS telegram_connection_status VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'group_telegram_type') THEN
    CREATE TYPE group_telegram_type AS ENUM ('group', 'channel', 'none');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'group_connection_status') THEN
    CREATE TYPE group_connection_status AS ENUM ('UNVERIFIED', 'PENDING', 'CONNECTED', 'ERROR');
  END IF;
END $$;

ALTER TABLE bible_study_groups
  ALTER COLUMN telegram_type TYPE group_telegram_type USING
    CASE telegram_type WHEN 'group' THEN 'group'::group_telegram_type
                       WHEN 'channel' THEN 'channel'::group_telegram_type
                       ELSE 'none'::group_telegram_type END,
  ALTER COLUMN telegram_connection_status TYPE group_connection_status USING
    CASE telegram_connection_status WHEN 'UNVERIFIED' THEN 'UNVERIFIED'::group_connection_status
                                    WHEN 'PENDING' THEN 'PENDING'::group_connection_status
                                    WHEN 'CONNECTED' THEN 'CONNECTED'::group_connection_status
                                    WHEN 'ERROR' THEN 'ERROR'::group_connection_status
                                    ELSE 'UNVERIFIED'::group_connection_status END,
  ALTER COLUMN telegram_type SET NOT NULL,
  ALTER COLUMN telegram_connection_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bible_group_group_email_check') THEN
    ALTER TABLE bible_study_groups ADD CONSTRAINT bible_group_group_email_check
      CHECK (group_email IS NULL OR char_length(trim(group_email)) <= 320);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bible_group_google_maps_check') THEN
    ALTER TABLE bible_study_groups ADD CONSTRAINT bible_group_google_maps_check
      CHECK (google_maps_link IS NULL OR char_length(trim(google_maps_link)) <= 2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bible_group_telegram_type_check') THEN
    ALTER TABLE bible_study_groups ADD CONSTRAINT bible_group_telegram_type_check
      CHECK (telegram_type IN ('group','channel','none'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bible_group_telegram_connection_status_check') THEN
    ALTER TABLE bible_study_groups ADD CONSTRAINT bible_group_telegram_connection_status_check
      CHECK (telegram_connection_status IN ('UNVERIFIED','PENDING','CONNECTED','ERROR'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bible_study_groups_telegram_status
  ON bible_study_groups(telegram_connection_status)
  WHERE telegram_connection_status <> 'UNVERIFIED';

