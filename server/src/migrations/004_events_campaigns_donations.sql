-- ============================================================================
-- Church Website — Migration 004: events + event_registrations + fundraising_campaigns + donation_categories + donations
-- ============================================================================

-- ----------------------------------------------------------------------------
-- events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location_text VARCHAR(500),
    location_id BIGINT REFERENCES program_locations(id),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    capacity INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    image_url TEXT,
    audience_department_id BIGINT REFERENCES departments(id),
    notify_members BOOLEAN NOT NULL DEFAULT TRUE,
    notify_all_members BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON events(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);

-- ----------------------------------------------------------------------------
-- event_registrations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_registrations (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

-- ----------------------------------------------------------------------------
-- fundraising_campaigns
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fundraising_campaigns (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    goal_amount NUMERIC(18,2),
    currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    category_id BIGINT REFERENCES donation_categories(id),
    banner_url TEXT,
    cta_url TEXT,
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON fundraising_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_category_id ON fundraising_campaigns(category_id);

-- ----------------------------------------------------------------------------
-- donation_categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donation_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_is_active ON donation_categories(is_active);

-- ----------------------------------------------------------------------------
-- donations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donations (
    id BIGSERIAL PRIMARY KEY,
    amount NUMERIC(18,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payment_reference VARCHAR(200),
    received_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    recorded_by BIGINT NOT NULL REFERENCES users(id),
    user_id BIGINT REFERENCES users(id),
    category_id BIGINT REFERENCES donation_categories(id),
    campaign_id BIGINT REFERENCES fundraising_campaigns(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_deleted_at ON donations(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_campaign_id ON donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_category_id ON donations(category_id);

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_events_updated ON events;
CREATE TRIGGER trg_events_updated
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_fundraising_campaigns_updated ON fundraising_campaigns;
CREATE TRIGGER trg_fundraising_campaigns_updated
    BEFORE UPDATE ON fundraising_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_donations_updated ON donations;
CREATE TRIGGER trg_donations_updated
    BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
