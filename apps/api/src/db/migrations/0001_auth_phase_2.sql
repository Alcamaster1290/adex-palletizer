BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_active_uq
  ON data_trade.users (lower(email))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS auth_sessions_status_expires_idx
  ON data_trade.auth_sessions (session_status, expires_at);

CREATE INDEX IF NOT EXISTS auth_sessions_last_seen_at_idx
  ON data_trade.auth_sessions (last_seen_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS auth_accounts_user_provider_idx
  ON data_trade.auth_accounts (user_id, provider);

CREATE INDEX IF NOT EXISTS user_module_access_user_active_idx
  ON data_trade.user_module_access (user_id, access_level)
  WHERE revoked_at IS NULL;

COMMIT;
