ALTER TABLE donation_categories
    ADD COLUMN IF NOT EXISTS category_code VARCHAR(40);

CREATE UNIQUE INDEX IF NOT EXISTS donation_categories_category_code_unique
    ON donation_categories(category_code)
    WHERE category_code IS NOT NULL;

WITH candidates AS (
    SELECT id,
        CASE
            WHEN LOWER(name) LIKE '%asrate%' OR LOWER(name) LIKE '%tithe%' THEN 'ASRATE'
            WHEN LOWER(name) LIKE '%meba%' OR LOWER(name) LIKE '%general offering%' THEN 'MEBA'
            WHEN LOWER(name) LIKE '%bekurat%' OR LOWER(name) LIKE '%first fruit%' THEN 'BEKURAT_KEDAMYAT'
            WHEN LOWER(name) LIKE '%meswa%' OR LOWER(name) LIKE '%kurban%' THEN 'MESWAET_KURBAN'
            WHEN LOWER(name) LIKE '%misgana%' OR LOWER(name) LIKE '%thanksgiving%' THEN 'MISGANA'
            WHEN LOWER(name) LIKE '%metasabiya%' OR LOWER(name) LIKE '%memorial%' THEN 'METASABIYA'
            WHEN LOWER(name) LIKE '%building fund%' OR LOWER(name) LIKE '%hinzat%' THEN 'BUILDING_FUND'
            WHEN LOWER(name) LIKE '%charity%' OR LOWER(name) LIKE '%alms%' OR LOWER(name) LIKE '%bego%' THEN 'CHARITY_ALMS'
            WHEN LOWER(name) LIKE '%fiker%' OR LOWER(name) LIKE '%love offering%' THEN 'FIKER_SETOTA'
        END AS category_code
    FROM donation_categories
    WHERE category_code IS NULL
), ranked AS (
    SELECT id, category_code,
        ROW_NUMBER() OVER (PARTITION BY category_code ORDER BY id) AS position
    FROM candidates
    WHERE category_code IS NOT NULL
)
UPDATE donation_categories AS category
SET category_code = ranked.category_code
FROM ranked
WHERE category.id = ranked.id AND ranked.position = 1;

INSERT INTO donation_categories (name, description, category_code, is_active)
VALUES
    ('Asrate / Tithe (አሥራት)', 'Regular tithe', 'ASRATE', TRUE),
    ('Meba / General Offering (መባ)', 'General offering', 'MEBA', TRUE),
    ('Bekurat & Kedamyat / First Fruits', 'First fruits offering', 'BEKURAT_KEDAMYAT', TRUE),
    ('Meswa''et / Kurban', 'Worship and sacramental offering', 'MESWAET_KURBAN', TRUE),
    ('Misgana / Thanksgiving Offering', 'Thanksgiving offering', 'MISGANA', TRUE),
    ('Metasabiya / Memorial Offering', 'Memorial offering', 'METASABIYA', TRUE),
    ('Ye''Hinzat Setota / Building Fund', 'Church building fund', 'BUILDING_FUND', TRUE),
    ('Ye''Bego Adiragot / Charity & Alms Fund', 'Charity and alms fund', 'CHARITY_ALMS', TRUE),
    ('Fiker Setota / Love Offering', 'Love offering', 'FIKER_SETOTA', TRUE),
    ('Other / Specify Purpose', 'Other specified giving purpose', 'OTHER', TRUE)
ON CONFLICT (category_code) WHERE category_code IS NOT NULL
DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = TRUE;

ALTER TABLE donations
    ADD COLUMN IF NOT EXISTS other_purpose VARCHAR(500),
    ADD COLUMN IF NOT EXISTS payer_mode VARCHAR(12) NOT NULL DEFAULT 'SELF',
    ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(160),
    ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(40),
    ADD COLUMN IF NOT EXISTS recipient_member_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE donations
    ADD CONSTRAINT donations_payer_mode_check
    CHECK (payer_mode IN ('SELF', 'OTHER'));

ALTER TABLE donations
    ADD CONSTRAINT donations_recipient_required_check
    CHECK (
        (payer_mode = 'SELF' AND recipient_name IS NULL AND recipient_phone IS NULL)
        OR (payer_mode = 'OTHER' AND recipient_name IS NOT NULL AND recipient_phone IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS donations_recipient_member_idx
    ON donations(recipient_member_id)
    WHERE recipient_member_id IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS donation_receipt_number_seq;
