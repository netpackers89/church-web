ALTER TABLE program_schedules
  ADD COLUMN IF NOT EXISTS recurrence_start_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'program_schedules_recurrence_date_order'
      AND conrelid = 'program_schedules'::regclass
  ) THEN
    ALTER TABLE program_schedules
      ADD CONSTRAINT program_schedules_recurrence_date_order
      CHECK (
        recurrence_start_date IS NULL
        OR recurrence_end_date IS NULL
        OR recurrence_start_date <= recurrence_end_date
      );
  END IF;
END;
$$;
