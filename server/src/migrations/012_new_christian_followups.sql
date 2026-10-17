-- ==========================================================================
-- Church Website — Migration 012: new Christian follow-up workflow
-- --------------------------------------------------------------------------
-- New believers and people still exploring faith need a separate follow-up
-- record from full member accounts. This table keeps their pastoral journey
-- visible to authorized staff without forcing them into the standard member
-- registration flow.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS new_christian_followups (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(160) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    email VARCHAR(320),
    location VARCHAR(160) NOT NULL,
    preferred_contact_method VARCHAR(20) NOT NULL DEFAULT 'phone',
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    accepted_jesus BOOLEAN NOT NULL DEFAULT FALSE,
    consent_to_contact BOOLEAN NOT NULL DEFAULT FALSE,
    prayer_request TEXT,
    status VARCHAR(40) NOT NULL DEFAULT 'NEWCOMER',
    linked_user_id BIGINT,
    telegram_chat_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_new_christian_followups_status
    ON new_christian_followups (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_new_christian_followups_phone
    ON new_christian_followups (phone);
