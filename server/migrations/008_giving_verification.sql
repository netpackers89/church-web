-- Approval/rejection tracking for giving records so finance staff can review
-- transfers and produce auditable receipts. Pending and rejected contributions
-- are NOT counted as confirmed income.
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS verified_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Review queue and receipt reporting indexes.
CREATE INDEX IF NOT EXISTS donations_status_idx
  ON donations(status, received_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS donations_verified_idx
  ON donations(verified_at DESC) WHERE status = 'APPROVED';
CREATE INDEX IF NOT EXISTS donations_rejected_idx
  ON donations(rejected_at DESC) WHERE status = 'REJECTED';
