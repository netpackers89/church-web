-- ============================================================================
-- Church Website — Migration 019: payment submission details and review history
-- ============================================================================

ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(80),
    ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(120),
    ADD COLUMN IF NOT EXISTS contributor_name VARCHAR(160),
    ADD COLUMN IF NOT EXISTS donor_note TEXT,
    ADD COLUMN IF NOT EXISTS receipt_url TEXT,
    ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(80),
    ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;

ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS supersedes_donation_id BIGINT REFERENCES donations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donations_receipt_number_unique
    ON donations(receipt_number) WHERE receipt_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donations_payment_reference_unique
    ON donations(payment_method_id, LOWER(payment_reference))
    WHERE payment_method_id IS NOT NULL AND payment_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donations_single_resubmission_unique
    ON donations(supersedes_donation_id) WHERE supersedes_donation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS donation_review_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    donation_id BIGINT NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
    reviewer_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    decision VARCHAR(24) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED')),
    reviewer_note TEXT,
    previous_status VARCHAR(20),
    next_status VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS donation_review_history_record_idx
    ON donation_review_history(donation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS donation_notification_deliveries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    donation_id BIGINT NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
    channel VARCHAR(16) NOT NULL CHECK (channel IN ('EMAIL', 'TELEGRAM')),
    outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('PENDING', 'DELIVERED', 'FAILED', 'SKIPPED')),
    error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (donation_id, channel)
);
