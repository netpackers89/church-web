ALTER TABLE events
  ADD COLUMN IF NOT EXISTS audience_group_id BIGINT,
  ADD COLUMN IF NOT EXISTS audience_group_type VARCHAR(30);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='events_audience_group_type_check') THEN
    ALTER TABLE events ADD CONSTRAINT events_audience_group_type_check
      CHECK (audience_group_type IS NULL OR audience_group_type IN ('department','bible_study_group'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='events_audience_group_pair_check') THEN
    ALTER TABLE events ADD CONSTRAINT events_audience_group_pair_check
      CHECK ((audience_group_id IS NULL) = (audience_group_type IS NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_group_schedule
  ON events(audience_group_type,audience_group_id,starts_at)
  WHERE deleted_at IS NULL AND audience_group_id IS NOT NULL;
