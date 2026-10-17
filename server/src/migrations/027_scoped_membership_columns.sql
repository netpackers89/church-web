DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'department_members'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE department_members
      ADD COLUMN role VARCHAR(40) NOT NULL DEFAULT 'MEMBER';
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'department_members'
        AND column_name = 'member_role'
    ) THEN
      UPDATE department_members SET role = member_role WHERE member_role IS NOT NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'department_members'
      AND column_name = 'member_role'
  ) THEN
    EXECUTE $function$
      CREATE OR REPLACE FUNCTION sync_department_membership_role_columns()
      RETURNS TRIGGER AS $body$
      BEGIN
        IF NEW.role IS NULL OR NEW.role = 'MEMBER' THEN
          NEW.role := COALESCE(NEW.member_role, NEW.role, 'MEMBER');
        END IF;
        IF NEW.member_role IS NULL OR NEW.member_role = 'MEMBER' THEN
          NEW.member_role := COALESCE(NEW.role, NEW.member_role, 'MEMBER');
        END IF;
        RETURN NEW;
      END;
      $body$ LANGUAGE plpgsql
    $function$;
    DROP TRIGGER IF EXISTS trg_sync_department_membership_role_columns ON department_members;
    CREATE TRIGGER trg_sync_department_membership_role_columns
      BEFORE INSERT OR UPDATE ON department_members
      FOR EACH ROW EXECUTE FUNCTION sync_department_membership_role_columns();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.bible_study_memberships') IS NULL THEN
    CREATE TABLE bible_study_memberships (
      bible_study_group_id BIGINT NOT NULL REFERENCES bible_study_groups(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(40) NOT NULL DEFAULT 'MEMBER',
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (bible_study_group_id, user_id)
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'bible_study_memberships'
        AND column_name = 'bible_study_group_id'
    ) THEN
      ALTER TABLE bible_study_memberships
        ADD COLUMN bible_study_group_id BIGINT REFERENCES bible_study_groups(id) ON DELETE CASCADE;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'bible_study_memberships'
          AND column_name = 'group_id'
      ) THEN
        UPDATE bible_study_memberships SET bible_study_group_id = group_id WHERE bible_study_group_id IS NULL;
      END IF;
    END IF;
    ALTER TABLE bible_study_memberships
      ADD COLUMN IF NOT EXISTS role VARCHAR(40) NOT NULL DEFAULT 'MEMBER';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'bible_study_memberships'
      AND column_name = 'group_id'
  ) THEN
    EXECUTE $function$
      CREATE OR REPLACE FUNCTION sync_bible_study_membership_group_columns()
      RETURNS TRIGGER AS $body$
      BEGIN
        IF NEW.bible_study_group_id IS NULL THEN
          NEW.bible_study_group_id := NEW.group_id;
        END IF;
        IF NEW.group_id IS NULL THEN
          NEW.group_id := NEW.bible_study_group_id;
        END IF;
        RETURN NEW;
      END;
      $body$ LANGUAGE plpgsql
    $function$;
    DROP TRIGGER IF EXISTS trg_sync_bible_study_membership_group_columns ON bible_study_memberships;
    CREATE TRIGGER trg_sync_bible_study_membership_group_columns
      BEFORE INSERT OR UPDATE ON bible_study_memberships
      FOR EACH ROW EXECUTE FUNCTION sync_bible_study_membership_group_columns();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bible_study_memberships_user_role_idx
  ON bible_study_memberships(user_id, role);