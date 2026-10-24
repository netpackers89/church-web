CREATE TABLE IF NOT EXISTS telegram_inbox_categories (
    code VARCHAR(40) PRIMARY KEY,
    label VARCHAR(80) NOT NULL,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO telegram_inbox_categories (code, label, is_sensitive, sort_order)
VALUES
    ('UNCLASSIFIED', 'Uncategorized legacy messages', FALSE, 0),
    ('SUGGESTION', 'Suggestions', FALSE, 10),
    ('PROBLEM_REPORT', 'Problem reports', FALSE, 20),
    ('PRAYER_REQUEST', 'Prayer requests', TRUE, 30),
    ('APPRECIATION', 'Appreciation and testimonies', FALSE, 40),
    ('GENERAL_QUESTION', 'General questions', FALSE, 50),
    ('PASTORAL_SUPPORT', 'Pastoral support', TRUE, 60),
    ('TECHNICAL_ISSUE', 'Technical issues', FALSE, 70),
    ('OTHER', 'Other', FALSE, 80)
ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    is_sensitive = EXCLUDED.is_sensitive,
    sort_order = EXCLUDED.sort_order;

ALTER TABLE telegram_messages
    ADD COLUMN IF NOT EXISTS category_code VARCHAR(40) REFERENCES telegram_inbox_categories(code),
    ADD COLUMN IF NOT EXISTS priority VARCHAR(12) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN IF NOT EXISTS assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reference_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS source_channel VARCHAR(20) NOT NULL DEFAULT 'TELEGRAM',
    ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE telegram_messages
SET category_code = 'UNCLASSIFIED'
WHERE category_code IS NULL;

ALTER TABLE telegram_messages
    ALTER COLUMN category_code SET DEFAULT 'UNCLASSIFIED',
    ALTER COLUMN category_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_messages_reference_code_idx
    ON telegram_messages(reference_code)
    WHERE reference_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS telegram_messages_category_status_idx
    ON telegram_messages(category_code, status, received_at DESC);
CREATE INDEX IF NOT EXISTS telegram_messages_assigned_to_idx
    ON telegram_messages(assigned_to, status);

CREATE TABLE IF NOT EXISTS telegram_message_notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_message_id BIGINT NOT NULL REFERENCES telegram_messages(id) ON DELETE CASCADE,
    note TEXT NOT NULL CHECK (length(note) <= 4000),
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_message_status_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    telegram_message_id BIGINT NOT NULL REFERENCES telegram_messages(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE telegram_menu_items
    ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE telegram_menu_items
    DROP CONSTRAINT IF EXISTS telegram_menu_items_action_type_check;
ALTER TABLE telegram_menu_items
    ADD CONSTRAINT telegram_menu_items_action_type_check
    CHECK (action_type IN ('TEXT', 'URL', 'PROFILE', 'GROUPS', 'PROGRAMS', 'GIVING', 'HELP', 'CAMPAIGNS', 'LOCATION', 'CONTACT'));

INSERT INTO telegram_menu_items
    (item_key, label_i18n, response_i18n, action_type, visibility, sort_order, is_active, is_builtin)
VALUES
    ('builtin_programs', '{"en":"📅 Programs & Events","am":"📅 ፕሮግራሞችና ዝግጅቶች","om":"📅 Sagantaalee fi Taateewwan"}', '{}', 'PROGRAMS', 'EVERYONE', 10, TRUE, TRUE),
    ('builtin_giving', '{"en":"🏦 Church Giving Accounts","am":"🏦 የመዋጮ መለያዎች","om":"🏦 Herrega Kennaa"}', '{}', 'GIVING', 'EVERYONE', 20, TRUE, TRUE),
    ('builtin_campaigns', '{"en":"🪙 Fundraising Campaigns","am":"🪙 የገንዘብ ማሰባሰብ","om":"🪙 Maallaqa Walitti Qabuu"}', '{}', 'CAMPAIGNS', 'EVERYONE', 30, TRUE, TRUE),
    ('builtin_location', '{"en":"📍 Church Location","am":"📍 የቤተ ክርስቲያን አድራሻ","om":"📍 Teessuma Waldaa"}', '{}', 'LOCATION', 'EVERYONE', 40, TRUE, TRUE),
    ('builtin_profile', '{"en":"👤 My Profile & Settings","am":"👤 የእኔ መገለጫና ቅንብሮች","om":"👤 Piroofaayilii fi Qindaa''ina Koo"}', '{}', 'PROFILE', 'EVERYONE', 50, TRUE, TRUE),
    ('builtin_help', '{"en":"❓ Help & Support","am":"❓ እገዛ","om":"❓ Gargaarsa"}', '{}', 'HELP', 'EVERYONE', 60, TRUE, TRUE),
    ('builtin_contact', '{"en":"✉️ Contact the Church","am":"✉️ ቤተ ክርስቲያንን ያነጋግሩ","om":"✉️ Waldaa Quunnamaa"}', '{}', 'CONTACT', 'EVERYONE', 70, TRUE, TRUE)
ON CONFLICT (item_key) DO NOTHING;

ALTER TABLE telegram_menu_items
    ALTER COLUMN is_builtin SET DEFAULT FALSE;
