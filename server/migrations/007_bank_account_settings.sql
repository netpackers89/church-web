-- Bank account details shown to the public on the giving page (admin-configured).
-- Stored in system_settings as a JSONB value; is_public = TRUE so the public
-- endpoint may expose them. Never commit real account credentials to source code.
INSERT INTO system_settings(key, value, is_public)
VALUES (
  'bank_account',
  '{"bankName":"","accountHolder":"","accountNumber":"","bankBranch":"","transferInstructions":"","currency":"ETB"}'::jsonb,
  TRUE
)
ON CONFLICT (key) DO NOTHING;

-- Indexes to support the finance review queue (sorted by review time).
CREATE INDEX IF NOT EXISTS donations_received_at_idx
ON donations(received_at DESC) WHERE status = 'PENDING';
