-- Migration 004: Enhanced user profile (lead capture) + account soft lockout
-- Run against the shared Neon PostgreSQL database.
-- All changes are non-breaking: nullable columns with no default constraints.
-- Safe to apply before or alongside code deployments.

BEGIN;

-- ─── Lead capture columns on usuario_profiles ────────────────────────────────
-- phone: stored in E.164 format (e.g. +51987654321). Validated at app layer.
-- job_title: declared role. Enum enforced at app layer, stored as varchar.

ALTER TABLE public.usuario_profiles
  ADD COLUMN IF NOT EXISTS phone      varchar(30) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS job_title  varchar(40) DEFAULT NULL;

COMMENT ON COLUMN public.usuario_profiles.phone IS
  'Teléfono de contacto en formato E.164 (ej. +51987654321). Opcional. Capturado en registro self-serve v2.';

COMMENT ON COLUMN public.usuario_profiles.job_title IS
  'Cargo declarado en el formulario de registro. '
  'Valores esperados: logistics_manager, operations_director, ceo_founder, it_developer, other. '
  'Validado en capa de aplicación; almacenado como varchar para flexibilidad futura.';

-- ─── Soft lockout on usuarios ─────────────────────────────────────────────────
-- locked_until: timestamp of automatic temporary lockout expiry.
--   NULL or < NOW()  → not locked (normal login allowed)
--   >= NOW()         → locked (login returns 423)
-- This is SEPARATE from status = 'locked' which is a permanent admin-imposed lock.
-- Both are checked at login; either condition blocks access.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS locked_until timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.usuarios.locked_until IS
  'Expiración de bloqueo temporal automático (por intentos fallidos). '
  'NULL o < NOW() = sin bloqueo. '
  'Distinto del bloqueo permanente status=''locked'' que requiere acción de admin.';

-- Partial index to speed up "is this account temporarily locked?" check at login.
-- Only indexes rows where locked_until IS NOT NULL (small fraction of users).
CREATE INDEX IF NOT EXISTS usuarios_locked_until_idx
  ON public.usuarios (locked_until)
  WHERE locked_until IS NOT NULL;

COMMIT;
