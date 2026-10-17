-- ==============================================================================
-- Church Website - Migration 024: Department & Bible study group constraints
-- (additive + idempotent; written as a follow-up to migration 023)
-- ==============================================================================

-- departments
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

-- bible_study_groups
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

