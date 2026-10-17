-- ============================================================================
-- Church Website — Migration 001: RBAC + users + email reset
-- ============================================================================

-- ----------------------------------------------------------------------------
-- permissions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- ----------------------------------------------------------------------------
-- roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE
);

-- ----------------------------------------------------------------------------
-- role_permissions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(320) NOT NULL,
    phone VARCHAR(40),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'en',
    birth_date_ec DATE,
    birth_date_gregorian DATE,
    location VARCHAR(120),
    other_location VARCHAR(120),
    notify_email BOOLEAN NOT NULL DEFAULT TRUE,
    notify_telegram BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_chat_id VARCHAR(100),
    session_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone) WHERE phone IS NOT NULL;

-- ----------------------------------------------------------------------------
-- user_roles (many-to-many between users and roles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by BIGINT REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- ----------------------------------------------------------------------------
-- Triggers for automatic updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
