BEGIN;

CREATE TABLE IF NOT EXISTS data_trade.auth_handoff_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES data_trade.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  target_module text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by_ip_hash text,
  used_by_ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_handoff_codes_code_hash_uq
  ON data_trade.auth_handoff_codes (code_hash);

CREATE INDEX IF NOT EXISTS auth_handoff_codes_user_idx
  ON data_trade.auth_handoff_codes (user_id);

CREATE INDEX IF NOT EXISTS auth_handoff_codes_target_idx
  ON data_trade.auth_handoff_codes (target_module);

CREATE INDEX IF NOT EXISTS auth_handoff_codes_expires_at_idx
  ON data_trade.auth_handoff_codes (expires_at);

COMMIT;
