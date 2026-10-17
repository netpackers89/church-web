CREATE TABLE IF NOT EXISTS contact_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(320) NOT NULL,
    phone VARCHAR(40),
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','IN_PROGRESS','REPLIED','CLOSED')),
    handled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    handled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS contact_messages_inbox_idx ON contact_messages(status, created_at DESC);
