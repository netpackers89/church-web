-- ============================================================================
-- Church Website — Migration 003: programs + program_schedules + program_locations
-- ============================================================================

-- ----------------------------------------------------------------------------
-- program_locations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS program_locations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- programs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_programs_deleted_at ON programs(deleted_at) WHERE deleted_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- program_schedules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS program_schedules (
    id BIGSERIAL PRIMARY KEY,
    program_id BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name VARCHAR(150),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    weekday INTEGER,
    start_time TIME,
    end_time TIME,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- bible_study_groups — base table required by registration and membership
-- migrations that follow.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bible_study_groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    leader_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    location_id BIGINT REFERENCES program_locations(id) ON DELETE SET NULL,
    meeting_schedule TEXT,
    capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- Triggers (do not duplicate)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_programs_updated ON programs;
CREATE TRIGGER trg_programs_updated
    BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
