-- ============================================================================
-- Church Website — Migration 017: expire public follow-up link capabilities
-- ============================================================================

ALTER TABLE new_christian_followups
    ADD COLUMN IF NOT EXISTS link_secret_expires_at TIMESTAMPTZ;
