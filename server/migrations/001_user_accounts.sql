CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(320) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(24) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'PASTOR', 'FINANCE', 'LEADER', 'REGISTRAR', 'MEMBER', 'PARTNER')),
    account_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'DEACTIVATED')),
    session_version INTEGER NOT NULL DEFAULT 0,
    birth_date_ec VARCHAR(32) NOT NULL,
    birth_date_gregorian DATE NOT NULL,
    location VARCHAR(40) NOT NULL CHECK (location IN (
        'Gedera (Church Location)', 'Tafo Adebabaye', 'Yeka Abado Kela', 'G7', '13',
        'Arcema', 'Zoble Mikayele', 'Ayat Tafo', 'Lega Tafo', '140', 'Gari Tera', 'Other'
    )),
    other_location VARCHAR(120),
    notify_email BOOLEAN NOT NULL DEFAULT TRUE,
    notify_telegram BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_chat_id VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_other_location_consistency CHECK (
        (location = 'Other' AND other_location IS NOT NULL AND LENGTH(BTRIM(other_location)) > 0)
        OR (location <> 'Other' AND other_location IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone);
CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_chat_unique ON users (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_account_status_idx ON users (account_status);

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_link_tokens_user_idx ON telegram_link_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS telegram_link_tokens_expiry_idx ON telegram_link_tokens (expires_at) WHERE used_at IS NULL;