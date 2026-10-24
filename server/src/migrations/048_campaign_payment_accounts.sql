CREATE TABLE IF NOT EXISTS campaign_payment_accounts (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES fundraising_campaigns(id),
    name VARCHAR(120) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('BANK', 'TELEBIRR', 'OTHER')),
    account_holder VARCHAR(160),
    account_number VARCHAR(80),
    phone_number VARCHAR(40),
    branch VARCHAR(200),
    instructions VARCHAR(1000),
    currency VARCHAR(3) NOT NULL DEFAULT 'ETB' CHECK (currency ~ '^[A-Z]{3}$'),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (type = 'TELEBIRR' AND phone_number IS NOT NULL AND length(trim(phone_number)) > 0)
        OR (type <> 'TELEBIRR' AND account_number IS NOT NULL AND length(trim(account_number)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS campaign_payment_accounts_campaign_active_idx
    ON campaign_payment_accounts(campaign_id, is_active, id);

ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS campaign_payment_account_id BIGINT
        REFERENCES campaign_payment_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS donations_campaign_payment_account_idx
    ON donations(campaign_payment_account_id)
    WHERE campaign_payment_account_id IS NOT NULL;
