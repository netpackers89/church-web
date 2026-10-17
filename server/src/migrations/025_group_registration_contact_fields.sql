ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS leader_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(320);

ALTER TABLE bible_study_groups
  ADD COLUMN IF NOT EXISTS leader_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_contact_email_check') THEN
    ALTER TABLE departments ADD CONSTRAINT departments_contact_email_check
      CHECK (contact_email IS NULL OR char_length(trim(contact_email)) <= 320);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bible_study_groups_leader_name_check') THEN
    ALTER TABLE bible_study_groups ADD CONSTRAINT bible_study_groups_leader_name_check
      CHECK (leader_name IS NULL OR char_length(trim(leader_name)) <= 160);
  END IF;
END $$;