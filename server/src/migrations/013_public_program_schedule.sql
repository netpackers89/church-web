-- ==========================================================================
-- Church Website — Migration 013: public events and recurring program schedule
-- --------------------------------------------------------------------------
-- Additive compatibility for recurring program schedules and richer event
-- cards. Weekly occurrences are generated from schedule data, not copied into
-- the events table. Overrides model cancellations or postponements per date.
-- ==========================================================================

ALTER TABLE programs ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS category VARCHAR(80);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE program_schedules ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES program_locations(id);
ALTER TABLE program_schedules ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE program_schedules ADD COLUMN IF NOT EXISTS timezone VARCHAR(80) NOT NULL DEFAULT 'Africa/Addis_Ababa';
ALTER TABLE program_schedules ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category VARCHAR(80);
ALTER TABLE events ADD COLUMN IF NOT EXISTS requires_registration BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS program_schedule_overrides (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES program_schedules(id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('CANCELLED', 'POSTPONED', 'RESCHEDULED')),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    location_text VARCHAR(500),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (schedule_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_program_schedules_public_weekday
    ON program_schedules (weekday, status) WHERE weekday IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_program_schedule_overrides_date
    ON program_schedule_overrides (occurrence_date, status);
