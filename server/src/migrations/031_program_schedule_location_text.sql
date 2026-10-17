ALTER TABLE program_schedules
  ADD COLUMN IF NOT EXISTS location_text VARCHAR(500);