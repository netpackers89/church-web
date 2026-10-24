-- ============================================================================
-- Migration 033: Church Platform Redesign
-- Media types, bible_verses updated_at, group ownership, announcements relations,
-- account activation tokens used_at, and new believer follow-up enhancements.
-- ============================================================================

-- 1. Ensure bible_verses has updated_at column to support trigger and updates
ALTER TABLE bible_verses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Update media_items type constraint to support LOGO, PROFILE, etc.
ALTER TABLE media_items DROP CONSTRAINT IF EXISTS media_items_type_check;
ALTER TABLE media_items ADD CONSTRAINT media_items_type_check
    CHECK (type IN ('SERMON','FLYER','BANNER','VIDEO','AUDIO','IMAGE','DOCUMENT','ANNOUNCEMENT','CAMPAIGN','GALLERY','EVENT','LOGO','PROFILE'));

-- 3. Ensure account_activation_tokens has used_at column
ALTER TABLE account_activation_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- 4. Enhance announcements with group ownership, relations, and delivery metadata
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE CASCADE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS bible_study_group_id BIGINT REFERENCES bible_study_groups(id) ON DELETE CASCADE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS event_id BIGINT REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS program_id BIGINT REFERENCES programs(id) ON DELETE SET NULL;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) NOT NULL DEFAULT 'CHURCH';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS delivery_channels JSONB DEFAULT '["WEBSITE"]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_announcements_dept ON announcements(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_bsg ON announcements(bible_study_group_id) WHERE bible_study_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_org ON announcements(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target_audience);

-- 5. Add social media and schedule/location fields to departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS meeting_location VARCHAR(500);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS meeting_schedule VARCHAR(500);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(500);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS youtube_url VARCHAR(500);

-- 6. Add branding and contact fields to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS leader_name VARCHAR(160);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS leader_phone VARCHAR(40);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email VARCHAR(320);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS telegram_public_link VARCHAR(500);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS telegram_invite_link VARCHAR(500);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(500);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS youtube_url VARCHAR(500);

-- 7. Add social media and joining options to bible_study_groups
ALTER TABLE bible_study_groups ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(500);
ALTER TABLE bible_study_groups ADD COLUMN IF NOT EXISTS youtube_url VARCHAR(500);
ALTER TABLE bible_study_groups ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bible_study_groups ADD COLUMN IF NOT EXISTS enrollment_open BOOLEAN NOT NULL DEFAULT TRUE;

-- 8. Add status column to department_members
ALTER TABLE department_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- 9. Enhance new_christian_followups
ALTER TABLE new_christian_followups ADD COLUMN IF NOT EXISTS pastoral_notes TEXT;
ALTER TABLE new_christian_followups ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ;
ALTER TABLE new_christian_followups ADD COLUMN IF NOT EXISTS account_activated_at TIMESTAMPTZ;
ALTER TABLE new_christian_followups ADD COLUMN IF NOT EXISTS assigned_group_type VARCHAR(50);
ALTER TABLE new_christian_followups ADD COLUMN IF NOT EXISTS assigned_group_id BIGINT;
