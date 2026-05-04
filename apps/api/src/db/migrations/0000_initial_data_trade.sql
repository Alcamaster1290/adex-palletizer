BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS data_trade;

CREATE TABLE IF NOT EXISTS data_trade.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  username text,
  display_name text,
  password_hash text,
  password_hash_algorithm text,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  legacy_usuario_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_status_ck CHECK (status IN ('active', 'disabled', 'locked', 'pending'))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON data_trade.users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_uq ON data_trade.users (username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_status_idx ON data_trade.users (status);
CREATE INDEX IF NOT EXISTS users_last_login_at_idx ON data_trade.users (last_login_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS data_trade.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_status_ck CHECK (status IN ('active', 'disabled', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_uq ON data_trade.organizations (slug);
CREATE INDEX IF NOT EXISTS organizations_status_idx ON data_trade.organizations (status);

CREATE TABLE IF NOT EXISTS data_trade.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  display_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_key_uq ON data_trade.roles (key);

CREATE TABLE IF NOT EXISTS data_trade.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES data_trade.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES data_trade.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES data_trade.roles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  invited_by_user_id uuid REFERENCES data_trade.users(id) ON DELETE SET NULL,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_status_ck CHECK (status IN ('active', 'invited', 'disabled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS memberships_org_user_uq ON data_trade.memberships (organization_id, user_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON data_trade.memberships (user_id);
CREATE INDEX IF NOT EXISTS memberships_role_idx ON data_trade.memberships (role_id);

CREATE TABLE IF NOT EXISTS data_trade.auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES data_trade.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'credentials',
  provider_account_id text NOT NULL,
  password_hash text,
  password_hash_algorithm text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_provider_account_uq
  ON data_trade.auth_accounts (provider, provider_account_id);
CREATE INDEX IF NOT EXISTS auth_accounts_user_idx ON data_trade.auth_accounts (user_id);

CREATE TABLE IF NOT EXISTS data_trade.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES data_trade.users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  session_status text NOT NULL DEFAULT 'active',
  created_by_ip_hash text,
  revoked_by_ip_hash text,
  user_agent text,
  last_seen_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_sessions_status_ck CHECK (session_status IN ('active', 'revoked', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_refresh_token_hash_uq ON data_trade.auth_sessions (refresh_token_hash);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON data_trade.auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON data_trade.auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS data_trade.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modules_status_ck CHECK (status IN ('active', 'disabled', 'hidden'))
);

CREATE UNIQUE INDEX IF NOT EXISTS modules_key_uq ON data_trade.modules (key);
CREATE INDEX IF NOT EXISTS modules_status_idx ON data_trade.modules (status);

CREATE TABLE IF NOT EXISTS data_trade.user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES data_trade.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES data_trade.modules(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES data_trade.organizations(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'user',
  granted_by_user_id uuid REFERENCES data_trade.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_module_access_level_ck CHECK (access_level IN ('user', 'manager', 'admin'))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_module_access_user_module_org_uq
  ON data_trade.user_module_access (
    user_id,
    module_id,
    (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );
CREATE INDEX IF NOT EXISTS user_module_access_module_idx ON data_trade.user_module_access (module_id);

CREATE TABLE IF NOT EXISTS data_trade.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES data_trade.organizations(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES data_trade.users(id) ON DELETE SET NULL,
  module_id uuid REFERENCES data_trade.modules(id) ON DELETE SET NULL,
  name text NOT NULL,
  project_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_status_ck CHECK (status IN ('active', 'archived', 'deleted'))
);

CREATE INDEX IF NOT EXISTS projects_owner_idx ON data_trade.projects (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS projects_org_idx ON data_trade.projects (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS projects_module_idx ON data_trade.projects (module_id);

CREATE TABLE IF NOT EXISTS data_trade.palletizer_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES data_trade.projects(id) ON DELETE SET NULL,
  user_id uuid REFERENCES data_trade.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES data_trade.organizations(id) ON DELETE SET NULL,
  mode text NOT NULL,
  input_payload jsonb NOT NULL,
  result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT palletizer_runs_mode_ck CHECK (mode IN ('single', 'multi', 'container'))
);

CREATE INDEX IF NOT EXISTS palletizer_runs_user_created_idx ON data_trade.palletizer_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS palletizer_runs_project_created_idx ON data_trade.palletizer_runs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS palletizer_runs_mode_idx ON data_trade.palletizer_runs (mode);

CREATE TABLE IF NOT EXISTS data_trade.map_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES data_trade.users(id) ON DELETE SET NULL,
  anonymous_id text,
  module_id uuid REFERENCES data_trade.modules(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS map_sessions_user_started_idx ON data_trade.map_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS map_sessions_anonymous_started_idx ON data_trade.map_sessions (anonymous_id, started_at DESC);

CREATE TABLE IF NOT EXISTS data_trade.search_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES data_trade.users(id) ON DELETE SET NULL,
  anonymous_id text,
  module_id uuid REFERENCES data_trade.modules(id) ON DELETE SET NULL,
  query text NOT NULL,
  normalized_query text,
  result_count integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_queries_user_created_idx ON data_trade.search_queries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS search_queries_module_created_idx ON data_trade.search_queries (module_id, created_at DESC);

CREATE TABLE IF NOT EXISTS data_trade.uploaded_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES data_trade.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES data_trade.organizations(id) ON DELETE SET NULL,
  project_id uuid REFERENCES data_trade.projects(id) ON DELETE SET NULL,
  module_id uuid REFERENCES data_trade.modules(id) ON DELETE SET NULL,
  storage_provider text NOT NULL,
  storage_key text NOT NULL,
  original_filename text NOT NULL,
  mime_type text,
  byte_size bigint,
  checksum_sha256 text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uploaded_files_status_ck CHECK (status IN ('active', 'deleted', 'quarantined'))
);

CREATE INDEX IF NOT EXISTS uploaded_files_user_created_idx ON data_trade.uploaded_files (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS uploaded_files_project_idx ON data_trade.uploaded_files (project_id);

CREATE TABLE IF NOT EXISTS data_trade.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  display_name text NOT NULL,
  source_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_sources_status_ck CHECK (status IN ('active', 'disabled', 'deprecated'))
);

CREATE UNIQUE INDEX IF NOT EXISTS data_sources_key_uq ON data_trade.data_sources (key);
CREATE INDEX IF NOT EXISTS data_sources_status_idx ON data_trade.data_sources (status);

CREATE TABLE IF NOT EXISTS data_trade.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES data_trade.users(id) ON DELETE SET NULL,
  anonymous_id text,
  module text NOT NULL,
  event_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  path text,
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_user_created_idx ON data_trade.events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_anonymous_created_idx ON data_trade.events (anonymous_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_module_name_created_idx ON data_trade.events (module, event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON data_trade.events (created_at DESC);

CREATE TABLE IF NOT EXISTS data_trade.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES data_trade.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_severity_ck CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx ON data_trade.audit_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx ON data_trade.audit_logs (action, created_at DESC);

CREATE TABLE IF NOT EXISTS data_trade.admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES data_trade.users(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES data_trade.users(id) ON DELETE SET NULL,
  note text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_notes_status_ck CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS admin_notes_target_created_idx ON data_trade.admin_notes (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notes_author_created_idx ON data_trade.admin_notes (author_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS data_trade.user_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES data_trade.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_flags_user_key_uq ON data_trade.user_flags (user_id, key);
CREATE INDEX IF NOT EXISTS user_flags_key_idx ON data_trade.user_flags (key);

INSERT INTO data_trade.roles (key, display_name, description)
VALUES
  ('admin', 'Admin', 'Administrador global de Data Trade'),
  ('owner', 'Owner', 'Administrador de organizacion'),
  ('analyst', 'Analyst', 'Usuario analitico operativo'),
  ('viewer', 'Viewer', 'Usuario de solo lectura')
ON CONFLICT (key) DO NOTHING;

INSERT INTO data_trade.modules (key, display_name, metadata)
VALUES
  ('sislope', 'SisLoPe', '{"category":"logistics-map"}'::jsonb),
  ('adex_palletizer', 'ADEX Palletizer', '{"category":"palletization"}'::jsonb),
  ('data_trade_analytics', 'Data Trade Analytics', '{"category":"analytics"}'::jsonb),
  ('alvin', 'ALVIN Cost Calculator', '{"category":"trade-costs"}'::jsonb),
  ('admin', 'Data Trade Admin', '{"category":"administration"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
