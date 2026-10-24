-- Public group discovery, joining, and privacy ============================================================================
-- 1) Adds public visibility / join-policy columns to bible_study_groups so the directory and joining flow
--    can be driven centrally from the database (kin to departments).
ALTER TABLE bible_study_groups
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'group_visibility') THEN
    CREATE TYPE group_visibility AS ENUM ('public', 'private', 'invitation_only');
  END IF;
END $$;

ALTER TABLE bible_study_groups ALTER COLUMN visibility DROP DEFAULT;

ALTER TABLE bible_study_groups
  ALTER COLUMN visibility TYPE group_visibility
    USING CASE bible_study_groups.visibility
           WHEN 'public' THEN 'public'::group_visibility
           WHEN 'private' THEN 'private'::group_visibility
           WHEN 'invitation_only' THEN 'invitation_only'::group_visibility
           ELSE 'public'::group_visibility
         END;

ALTER TABLE bible_study_groups
  ALTER COLUMN visibility SET DEFAULT 'public'::group_visibility;

ALTER TABLE bible_study_groups
  ALTER COLUMN visibility SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bible_study_groups_visibility_check') THEN
    ALTER TABLE bible_study_groups ADD CONSTRAINT bible_study_groups_visibility_check
      CHECK (visibility IN ('public', 'private', 'invitation_only'));
  END IF;
END $$;

ALTER TABLE bible_study_groups
  ADD COLUMN IF NOT EXISTS enrollment_open BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE bible_study_groups
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE bible_study_groups
  ADD COLUMN IF NOT EXISTS public_leader_name VARCHAR(200);

-- 2) Central request table so join/discovery flows have a single source of truth for duplicate prevention and
--    leader-approval workflows. Existing memberships are used for the actual active member list.
CREATE TABLE IF NOT EXISTS member_join_requests (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES bible_study_groups(id) ON DELETE CASCADE,
  department_id BIGINT REFERENCES departments(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  source VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT member_join_requests_group_source CHECK (
    (group_id IS NOT NULL)::int + (department_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT member_join_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_join_requests_group_user
  ON member_join_requests(group_id, user_id) WHERE status = 'PENDING' AND group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_join_requests_dept_user
  ON member_join_requests(department_id, user_id) WHERE status = 'PENDING' AND department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_join_requests_user
  ON member_join_requests(user_id) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_member_join_requests_group_status
  ON member_join_requests(group_id, status);

COMMENT ON TABLE member_join_requests IS 'Public group membership requests awaiting approval.';
