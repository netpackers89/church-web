-- One-time, short-lived credentials for New Believer onboarding
-- ============================================================================

-- 1) Store a hash of the one-time temporary credential. Never persist plaintext.
CREATE TABLE IF NOT EXISTS temporary_activation_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL,
  purpose VARCHAR(40) NOT NULL DEFAULT 'NEW_BELIEVER_WELCOME',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT temporary_activation_tokens_single_use CHECK (purpose = 'NEW_BELIEVER_WELCOME')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_temporary_activation_tokens_token
  ON temporary_activation_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_temporary_activation_tokens_user_id
  ON temporary_activation_tokens (user_id) WHERE consumed_at IS NULL;

-- 2) Track new-believer onboarding lifecycle so the follow-up dashboard has stable state.
ALTER TABLE new_christian_followups
  ADD COLUMN IF NOT EXISTS registration_status VARCHAR(40) NOT NULL DEFAULT 'REGISTERED';

ALTER TABLE new_christian_followups
  ADD COLUMN IF NOT EXISTS invitation_email_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

ALTER TABLE new_christian_followups
  ADD COLUMN IF NOT EXISTS invitation_email_error TEXT;

ALTER TABLE new_christian_followups
  ADD COLUMN IF NOT EXISTS account_activated_at TIMESTAMPTZ;

ALTER TABLE new_christian_followups
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

ALTER TABLE new_christian_followups
  ADD COLUMN IF NOT EXISTS followup_worker_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE new_christian_followups
  ADD COLUMN IF NOT EXISTS followup_worker_name VARCHAR(160);

ALTER TABLE new_christian_followups
  ADD COLUMN IF NOT EXISTS group_integration_status VARCHAR(40) NOT NULL DEFAULT 'NOT_INVITED';

ALTER TABLE new_christian_followups
  ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

ALTER TABLE new_christian_followups
  ADD COLUMN IF NOT EXISTS telegram_link_token_hash BYTEA;

COMMENT ON COLUMN new_christian_followups.registration_status IS 'Workflow state: REGISTERED, INVITATION_PENDING, INVITATION_SENT, ACCOUNT_ACTIVATED, FOLLOW_UP_ASSIGNED, FOLLOW_UP_IN_PROGRESS, GROUP_INTEGRATED, COMPLETED.';
COMMENT ON COLUMN new_christian_followups.invitation_email_status IS 'Email delivery state: PENDING, DELIVERED, FAILED, SKIPPED.';
COMMENT ON COLUMN new_christian_followups.followup_worker_user_id IS 'Authorized follow-up worker assigned to this new believer.';
COMMENT ON COLUMN new_christian_followups.group_integration_status IS 'Onboarding progress toward a regular church group.';

-- 3) Invalidates a one-time welcome token after the recipient activates, and marks the invitation sent.
CREATE OR REPLACE FUNCTION reset_new_believer_invitation(token_hash BYTEA)
RETURNS BOOLEAN AS $$
DECLARE
  existing_token BYTEA;
BEGIN
  SELECT token_hash INTO existing_token
  FROM temporary_activation_tokens
  WHERE token_hash = reset_new_believer_invitation.token_hash
    AND consumed_at IS NULL
    AND expires_at > NOW();
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE temporary_activation_tokens
  SET consumed_at = NOW()
  WHERE token_hash = reset_new_believer_invitation.token_hash;

  UPDATE new_christian_followups
  SET invitation_email_status = 'INVITATION_SENT',
      email_delivery_error = NULL,
      updated_at = NOW()
  FROM temporary_activation_tokens
  WHERE temporary_activation_tokens.token_hash = reset_new_believer_invitation.token_hash
    AND temporary_activation_tokens.user_id = new_christian_followups.linked_user_id
    AND temporary_activation_tokens.purpose = 'NEW_BELIEVER_WELCOME';

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_new_believer_invitation(BYTEA) IS 'Invalidates a one-time welcome token after the recipient activates, and marks the invitation sent.';
