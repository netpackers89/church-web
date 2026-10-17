-- ============================================================================
-- Church Website — Migration 005: bible_verses + daily_verse_publications +
--                            bible_verse_publication_history
-- ============================================================================

-- ----------------------------------------------------------------------------
-- bible_verses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bible_verses (
    id BIGSERIAL PRIMARY KEY,
    book VARCHAR(50) NOT NULL,
    chapter INTEGER NOT NULL,
    verse_start INTEGER NOT NULL,
    verse_end INTEGER,
    verse_text TEXT NOT NULL,
    translation VARCHAR(100) NOT NULL,
    language VARCHAR(20) NOT NULL,
    version VARCHAR(100),
    reference VARCHAR(200),
    source VARCHAR(200),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bible_verses_book_chapter ON bible_verses(book, chapter);

-- ----------------------------------------------------------------------------
-- daily_verse_publications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_verse_publications (
    id BIGSERIAL PRIMARY KEY,
    verse_id BIGINT NOT NULL REFERENCES bible_verses(id) ON DELETE RESTRICT,
    publication_date DATE NOT NULL,
    publication_source VARCHAR(100) NOT NULL DEFAULT 'MANUAL',
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    publish_to_website BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_pub_status CHECK (status IN ('SCHEDULED','PUBLISHED','UNPUBLISHED','ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_verse_pub_date_status
    ON daily_verse_publications (publication_date, status)
    WHERE status IN ('SCHEDULED','PUBLISHED');

CREATE INDEX IF NOT EXISTS idx_daily_verse_published_at ON daily_verse_publications(published_at);

-- ----------------------------------------------------------------------------
-- bible_verse_publication_history
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bible_verse_publication_history (
    id BIGSERIAL PRIMARY KEY,
    publication_id BIGINT NOT NULL REFERENCES daily_verse_publications(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bible_pub_history_publication_id ON bible_verse_publication_history(publication_id);

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_bible_verses_updated ON bible_verses;
CREATE TRIGGER trg_bible_verses_updated
    BEFORE UPDATE ON bible_verses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_daily_verse_publications_updated ON daily_verse_publications;
CREATE TRIGGER trg_daily_verse_publications_updated
    BEFORE UPDATE ON daily_verse_publications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
