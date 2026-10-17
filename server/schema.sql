-- Executable PostgreSQL schema export (psql).
-- Run from this directory: psql "$DATABASE_URL" -f schema.sql
-- The migration runner remains the preferred deployment mechanism because it
-- records applied versions in schema_migrations.
\ir migrations/001_user_accounts.sql
\ir migrations/002_profile_security.sql
\ir migrations/003_platform_core.sql
\ir migrations/004_content_modules.sql
\ir migrations/005_operational_hardening.sql
\ir migrations/006_contact_messages.sql
\ir migrations/007_bank_account_settings.sql
\ir migrations/008_giving_verification.sql
\ir migrations/009_recovery_campaigns_and_event_notifications.sql
