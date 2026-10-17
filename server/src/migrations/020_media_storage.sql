CREATE TABLE IF NOT EXISTS media_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type VARCHAR(30) NOT NULL,
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

ALTER TABLE media_items ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(40);
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS storage_id VARCHAR(255);
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS is_thumbnail BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE media_items DROP CONSTRAINT IF EXISTS media_items_type_check;
ALTER TABLE media_items ADD CONSTRAINT media_items_type_check
    CHECK (type IN ('SERMON','FLYER','BANNER','VIDEO','AUDIO','IMAGE','DOCUMENT','ANNOUNCEMENT','CAMPAIGN','GALLERY','EVENT'));

CREATE INDEX IF NOT EXISTS media_items_storage_idx
    ON media_items(storage_provider, storage_id) WHERE storage_id IS NOT NULL;