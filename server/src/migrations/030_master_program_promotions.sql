ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS default_location VARCHAR(500),
  ADD COLUMN IF NOT EXISTS default_start_time TIME,
  ADD COLUMN IF NOT EXISTS default_end_time TIME,
  ADD COLUMN IF NOT EXISTS recurrence_weekday SMALLINT,
  ADD COLUMN IF NOT EXISTS notify_members BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_all_members BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS program_id BIGINT REFERENCES programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_speaker VARCHAR(200);

ALTER TABLE program_schedules
  ADD COLUMN IF NOT EXISTS location_text VARCHAR(500);

CREATE UNIQUE INDEX IF NOT EXISTS events_program_start_unique
  ON events(program_id, starts_at)
  WHERE program_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS events_program_id_idx
  ON events(program_id) WHERE program_id IS NOT NULL;