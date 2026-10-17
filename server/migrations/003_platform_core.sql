-- Core church-platform data model.  Existing `users` keeps its BIGINT key so
-- this migration is additive and can be applied to an installed database.
-- All timestamps are stored as TIMESTAMPTZ (UTC internally).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN','PASTOR','FINANCE','LEADER','REGISTRAR','STAFF','MEMBER','PARTNER'));

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles(role_id);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS departments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL UNIQUE,
    description TEXT,
    leader_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS staff_profiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(160) NOT NULL,
    title VARCHAR(160),
    responsibilities TEXT,
    employment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (employment_status IN ('ACTIVE','INACTIVE','ON_LEAVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS department_members (
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_role VARCHAR(40) NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (department_id, user_id)
);
CREATE INDEX IF NOT EXISTS department_members_user_idx ON department_members(user_id);

CREATE TABLE IF NOT EXISTS member_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    membership_status VARCHAR(24) NOT NULL DEFAULT 'VISITOR' CHECK (membership_status IN ('VISITOR','APPLICANT','MEMBER','INACTIVE')),
    joined_at TIMESTAMPTZ,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS membership_applications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(160) NOT NULL,
    contact_email VARCHAR(320),
    contact_phone VARCHAR(40),
    testimony TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','IN_REVIEW','APPROVED','REJECTED','WITHDRAWN')),
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS membership_applications_status_idx ON membership_applications(status, created_at DESC);

CREATE TABLE IF NOT EXISTS newcomer_followups (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id BIGINT REFERENCES membership_applications(id) ON DELETE CASCADE,
    member_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED','CLOSED')),
    note TEXT,
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (application_id IS NOT NULL OR member_user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS newcomer_followups_assignee_idx ON newcomer_followups(assigned_to, status);

CREATE TABLE IF NOT EXISTS program_locations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    address TEXT NOT NULL,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    is_church_home BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
CREATE UNIQUE INDEX IF NOT EXISTS program_locations_home_unique ON program_locations(is_church_home) WHERE is_church_home;

CREATE TABLE IF NOT EXISTS programs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS program_schedules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    program_id BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    location_id BIGINT REFERENCES program_locations(id) ON DELETE SET NULL,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    weekday SMALLINT CHECK (weekday BETWEEN 0 AND 6),
    start_time TIME,
    end_time TIME,
    recurrence_rule TEXT,
    timezone VARCHAR(80) NOT NULL DEFAULT 'Africa/Addis_Ababa',
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','CANCELLED')),
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at) OR (weekday IS NOT NULL AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);
CREATE INDEX IF NOT EXISTS program_schedules_start_idx ON program_schedules(starts_at) WHERE starts_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS program_schedules_weekday_idx ON program_schedules(weekday) WHERE weekday IS NOT NULL;

CREATE TABLE IF NOT EXISTS events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location_id BIGINT REFERENCES program_locations(id) ON DELETE SET NULL,
    location_text VARCHAR(300),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT','PUBLISHED','CANCELLED','ARCHIVED')),
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS events_public_idx ON events(status, starts_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS event_registrations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    guest_name VARCHAR(160),
    guest_email VARCHAR(320),
    status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED','CANCELLED','ATTENDED','WAITLISTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS event_registration_user_unique ON event_registrations(event_id, user_id) WHERE user_id IS NOT NULL AND status <> 'CANCELLED';

CREATE TABLE IF NOT EXISTS bible_verses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    book VARCHAR(100) NOT NULL,
    chapter INTEGER NOT NULL CHECK (chapter > 0),
    verse_start INTEGER NOT NULL CHECK (verse_start > 0),
    verse_end INTEGER,
    verse_text TEXT NOT NULL,
    translation VARCHAR(60) NOT NULL,
    language VARCHAR(16) NOT NULL DEFAULT 'en',
    source_attribution TEXT NOT NULL,
    source_url TEXT,
    verified_at TIMESTAMPTZ,
    verified_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (verse_end IS NULL OR verse_end >= verse_start)
);
CREATE UNIQUE INDEX IF NOT EXISTS bible_verses_reference_unique ON bible_verses (book, chapter, verse_start, COALESCE(verse_end, verse_start), translation, language);

CREATE TABLE IF NOT EXISTS daily_verse_publications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    verse_id BIGINT NOT NULL REFERENCES bible_verses(id) ON DELETE RESTRICT,
    publication_date DATE NOT NULL,
    reflection TEXT,
    explanation TEXT,
    publication_source VARCHAR(16) NOT NULL CHECK (publication_source IN ('AUTOMATIC','MANUAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','PUBLISHED','UNPUBLISHED','CANCELLED')),
    publish_to_website BOOLEAN NOT NULL DEFAULT TRUE,
    publish_to_telegram BOOLEAN NOT NULL DEFAULT FALSE,
    published_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_verse_active_date_unique ON daily_verse_publications(publication_date) WHERE status IN ('SCHEDULED','PUBLISHED');
CREATE INDEX IF NOT EXISTS daily_verse_publication_date_idx ON daily_verse_publications(publication_date DESC, status);

CREATE TABLE IF NOT EXISTS bible_verse_publication_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    publication_id BIGINT NOT NULL REFERENCES daily_verse_publications(id) ON DELETE CASCADE,
    action VARCHAR(32) NOT NULL,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_accounts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL UNIQUE,
    chat_id BIGINT,
    username VARCHAR(64),
    display_name VARCHAR(160),
    user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    linked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_updates (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_update_id BIGINT NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (processing_status IN ('NEW','PROCESSED','FAILED','DUPLICATE')),
    error_detail TEXT
);

CREATE TABLE IF NOT EXISTS telegram_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_update_id BIGINT REFERENCES telegram_updates(id) ON DELETE SET NULL,
    telegram_account_id BIGINT REFERENCES telegram_accounts(id) ON DELETE SET NULL,
    telegram_message_id BIGINT NOT NULL,
    chat_id BIGINT NOT NULL,
    content TEXT,
    content_type VARCHAR(40) NOT NULL DEFAULT 'text',
    received_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','IN_PROGRESS','REPLIED','CLOSED')),
    handled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    handled_at TIMESTAMPTZ,
    error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(chat_id, telegram_message_id)
);
CREATE INDEX IF NOT EXISTS telegram_messages_inbox_idx ON telegram_messages(status, received_at DESC);

CREATE TABLE IF NOT EXISTS telegram_notification_preferences (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    announcements BOOLEAN NOT NULL DEFAULT FALSE,
    daily_verses BOOLEAN NOT NULL DEFAULT FALSE,
    program_reminders BOOLEAN NOT NULL DEFAULT FALSE,
    event_invitations BOOLEAN NOT NULL DEFAULT FALSE,
    fundraising BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_templates (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL','TELEGRAM')),
    subject_template TEXT,
    body_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_id BIGINT REFERENCES notification_templates(id) ON DELETE SET NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    telegram_account_id BIGINT REFERENCES telegram_accounts(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL','TELEGRAM')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED','SKIPPED')),
    provider_message_id VARCHAR(120),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notification_deliveries_retry_idx ON notification_deliveries(status, created_at) WHERE status IN ('PENDING','FAILED');

CREATE TABLE IF NOT EXISTS announcements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
    published_at TIMESTAMPTZ,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS announcements_public_idx ON announcements(status, published_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS donation_categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fundraising_campaigns (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    goal_amount NUMERIC(14,2) CHECK (goal_amount IS NULL OR goal_amount >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'ETB',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','CLOSED','ARCHIVED')),
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS partners (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    website_url TEXT,
    logo_url TEXT,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS donations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    category_id BIGINT REFERENCES donation_categories(id) ON DELETE RESTRICT,
    campaign_id BIGINT REFERENCES fundraising_campaigns(id) ON DELETE SET NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'ETB',
    payment_reference VARCHAR(160) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','REFUNDED')),
    recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS donations_finance_idx ON donations(status, received_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(80),
    before_data JSONB,
    after_data JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Give existing accounts an RBAC assignment that reflects the legacy column.
INSERT INTO roles (code, name, description, is_system) VALUES
 ('ADMIN','Administrator','Full platform administration',TRUE),
 ('PASTOR','Pastor','Pastoral and publishing access',TRUE),
 ('LEADER','Leader','Department and programme leadership',TRUE),
 ('FINANCE','Finance','Financial management',TRUE),
 ('STAFF','Staff','Operational staff access',TRUE),
 ('MEMBER','Member','Standard member access',TRUE),
 ('PARTNER','Partner','Partner account access',TRUE),
 ('REGISTRAR','Registrar','Membership administration',TRUE)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO permissions (code, description) VALUES
 ('users.read','View member accounts'), ('users.manage','Manage member accounts'),
 ('roles.manage','Manage roles and permissions'), ('staff.manage','Manage staff and departments'),
 ('membership.manage','Manage membership applications'), ('programs.manage','Manage programs and schedules'),
 ('events.manage','Manage events and registrations'), ('bible.publish','Publish Bible verses'),
 ('telegram.manage','Manage Telegram inbox and settings'), ('announcements.manage','Manage announcements'),
 ('finance.manage','Manage finance records'), ('media.manage','Manage media records'),
 ('settings.manage','Manage system settings'), ('audit.read','Read audit logs'), ('reports.read','Read reports')
ON CONFLICT (code) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = u.role
ON CONFLICT DO NOTHING;

-- System role baseline.  These rows are data, not checks in application code;
-- administrators can add permissions to non-system roles through the API.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('bible.publish','announcements.manage','programs.manage','events.manage','membership.manage') WHERE r.code = 'PASTOR'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('staff.manage','programs.manage','events.manage') WHERE r.code = 'LEADER'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('finance.manage','reports.read') WHERE r.code = 'FINANCE'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('users.read','membership.manage') WHERE r.code = 'REGISTRAR'
ON CONFLICT DO NOTHING;

INSERT INTO system_settings (key, value, is_public) VALUES
 ('church.location', '{"name":"","address":"","latitude":null,"longitude":null}'::jsonb, TRUE),
 ('church.timezone', '"Africa/Addis_Ababa"'::jsonb, TRUE)
ON CONFLICT (key) DO NOTHING;
