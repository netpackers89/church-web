CREATE TABLE IF NOT EXISTS organizations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL UNIQUE,
    description TEXT,
    leader_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS departments_organization_idx ON departments(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS bible_study_groups (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
CREATE TABLE IF NOT EXISTS bible_study_memberships (
    group_id BIGINT NOT NULL REFERENCES bible_study_groups(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','DECLINED','TRANSFERRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(group_id,user_id)
);

CREATE TABLE IF NOT EXISTS media_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type VARCHAR(30) NOT NULL CHECK (type IN ('SERMON','FLYER','BANNER','VIDEO','AUDIO','IMAGE','DOCUMENT')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    published_at TIMESTAMPTZ,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS media_items_public_idx ON media_items(type, published_at DESC) WHERE is_public=TRUE AND deleted_at IS NULL;
