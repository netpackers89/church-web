-- ============================================================================
-- Church Website — Migration 002: audit_logs + departments + organizations
-- ============================================================================

-- ----------------------------------------------------------------------------
-- audit_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id BIGINT,
    before JSONB,
    after JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ----------------------------------------------------------------------------
-- departments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    organization_id BIGINT REFERENCES organizations(id),
    leader_user_id BIGINT REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_organization_id ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_deleted_at ON departments(deleted_at) WHERE deleted_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- department_members
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS department_members (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    assigned_by BIGINT REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, department_id)
);

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Triggers (do not duplicate)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_departments_updated ON departments;
CREATE TRIGGER trg_departments_updated
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
