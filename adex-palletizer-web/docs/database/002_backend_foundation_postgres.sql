-- ADEX Palletizer
-- Base de backend para autenticacion, sesiones, auditoria
-- y persistencia de escenarios/labels/exports.
-- Requiere haber ejecutado:
--   - docs/database/001_auth_usuarios_postgres.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  session_status varchar(20) NOT NULL DEFAULT 'active',
  created_by_ip inet,
  revoked_by_ip inet,
  user_agent text,
  last_seen_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_sessions_status_ck CHECK (session_status IN ('active', 'revoked', 'expired'))
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
  ON public.auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
  ON public.auth_sessions (expires_at);

DROP TRIGGER IF EXISTS trg_auth_sessions_set_updated_at ON public.auth_sessions;

CREATE TRIGGER trg_auth_sessions_set_updated_at
BEFORE UPDATE ON public.auth_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

COMMENT ON TABLE public.auth_sessions IS
  'Sesiones autenticadas del usuario. Guarda solo hash del refresh token.';

CREATE TABLE IF NOT EXISTS public.auth_password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  token_status varchar(20) NOT NULL DEFAULT 'active',
  requested_by_ip inet,
  used_by_ip inet,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_password_reset_tokens_status_ck CHECK (token_status IN ('active', 'used', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS auth_password_reset_tokens_user_id_idx
  ON public.auth_password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS auth_password_reset_tokens_expires_at_idx
  ON public.auth_password_reset_tokens (expires_at);

COMMENT ON TABLE public.auth_password_reset_tokens IS
  'Tokens de recuperacion de contrasena. Almacena solo hash del token temporal.';

CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.auth_sessions(id) ON DELETE SET NULL,
  event_type varchar(60) NOT NULL,
  event_severity varchar(20) NOT NULL DEFAULT 'info',
  event_source varchar(30) NOT NULL DEFAULT 'api',
  request_id uuid,
  ip_address inet,
  user_agent text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_audit_log_severity_ck CHECK (event_severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS auth_audit_log_user_id_idx
  ON public.auth_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_audit_log_event_type_idx
  ON public.auth_audit_log (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_audit_log_payload_gin_idx
  ON public.auth_audit_log USING gin (payload);

COMMENT ON TABLE public.auth_audit_log IS
  'Eventos de acceso, seguridad y trazabilidad operativa para analitica y auditoria.';

CREATE TABLE IF NOT EXISTS public.scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  name varchar(180) NOT NULL,
  mode varchar(20) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  latest_version integer NOT NULL DEFAULT 1,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  archived_at timestamptz,
  CONSTRAINT scenarios_mode_ck CHECK (mode IN ('single', 'multi', 'container')),
  CONSTRAINT scenarios_status_ck CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS scenarios_owner_user_id_idx
  ON public.scenarios (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scenarios_mode_idx
  ON public.scenarios (mode);

DROP TRIGGER IF EXISTS trg_scenarios_set_updated_at ON public.scenarios;

CREATE TRIGGER trg_scenarios_set_updated_at
BEFORE UPDATE ON public.scenarios
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

COMMENT ON TABLE public.scenarios IS
  'Escenarios persistidos por usuario. La version viva se resuelve en scenario_versions.';

CREATE TABLE IF NOT EXISTS public.scenario_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  created_by_user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  input_payload jsonb NOT NULL,
  result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  labels_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT scenario_versions_version_number_ck CHECK (version_number >= 1),
  CONSTRAINT scenario_versions_scenario_version_uq UNIQUE (scenario_id, version_number)
);

CREATE INDEX IF NOT EXISTS scenario_versions_scenario_id_idx
  ON public.scenario_versions (scenario_id, version_number DESC);

COMMENT ON TABLE public.scenario_versions IS
  'Versionado de escenarios para trazabilidad y comparacion de cambios.';

CREATE TABLE IF NOT EXISTS public.sku_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  sku_id varchar(120) NOT NULL,
  label_name varchar(180),
  label_config jsonb NOT NULL,
  texture_data_url text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT sku_labels_owner_sku_uq UNIQUE (owner_user_id, sku_id)
);

CREATE INDEX IF NOT EXISTS sku_labels_owner_user_id_idx
  ON public.sku_labels (owner_user_id);

DROP TRIGGER IF EXISTS trg_sku_labels_set_updated_at ON public.sku_labels;

CREATE TRIGGER trg_sku_labels_set_updated_at
BEFORE UPDATE ON public.sku_labels
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

COMMENT ON TABLE public.sku_labels IS
  'Etiquetas por SKU. En una fase posterior la textura deberia migrarse a object storage.';

CREATE TABLE IF NOT EXISTS public.export_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  scenario_id uuid REFERENCES public.scenarios(id) ON DELETE SET NULL,
  export_type varchar(40) NOT NULL,
  export_format varchar(20) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT export_history_format_ck CHECK (export_format IN ('json', 'png', 'svg', 'pdf')),
  CONSTRAINT export_history_type_ck CHECK (export_type IN ('scenario', 'container-plan', 'top-view', 'label'))
);

CREATE INDEX IF NOT EXISTS export_history_owner_user_id_idx
  ON public.export_history (owner_user_id, created_at DESC);

COMMENT ON TABLE public.export_history IS
  'Historial de exportaciones para analitica de uso y auditoria operativa.';

COMMIT;
