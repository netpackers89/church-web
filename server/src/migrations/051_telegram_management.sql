CREATE TABLE IF NOT EXISTS telegram_menu_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_key VARCHAR(64) NOT NULL UNIQUE,
    label_i18n JSONB NOT NULL,
    response_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_type VARCHAR(24) NOT NULL DEFAULT 'TEXT'
        CHECK (action_type IN ('TEXT', 'URL', 'PROFILE', 'GROUPS', 'PROGRAMS', 'GIVING', 'HELP')),
    target_url TEXT,
    visibility VARCHAR(20) NOT NULL DEFAULT 'EVERYONE'
        CHECK (visibility IN ('EVERYONE', 'LINKED_MEMBER')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_menu_items_active_order_idx
    ON telegram_menu_items(is_active, sort_order, id);

CREATE TABLE IF NOT EXISTS telegram_auto_reply_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    keywords JSONB NOT NULL,
    match_type VARCHAR(16) NOT NULL DEFAULT 'CONTAINS'
        CHECK (match_type IN ('EXACT', 'CONTAINS')),
    response_i18n JSONB NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_auto_reply_active_priority_idx
    ON telegram_auto_reply_rules(is_active, priority, id);
