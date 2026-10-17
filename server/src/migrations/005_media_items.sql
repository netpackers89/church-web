CREATE TABLE IF NOT EXISTS media_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type VARCHAR(30) NOT NULL CHECK (type IN ('SERMON','FLYER','BANNER','VIDEO','AUDIO','IMAGE','DOCUMENT','ANNOUNCEMENT','CAMPAIGN','GALLERY','EVENT')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    storage_provider VARCHAR(40),
    storage_id VARCHAR(255),
    is_thumbnail BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS media_items_type_idx ON media_items(type);
CREATE INDEX IF NOT EXISTS media_items_deleted_idx ON media_items(deleted_at) WHERE deleted_at IS NOT NULL;