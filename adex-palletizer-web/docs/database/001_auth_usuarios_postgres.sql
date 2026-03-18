-- ADEX Palletizer
-- DDL base para autenticacion profesional futura en PostgreSQL.
-- Estado actual:
--   - El frontend no ejecuta autenticacion real todavia.
--   - Este archivo deja preparada la tabla de usuarios y el usuario decoy
--     para futuros sprints de login / recuperar contrasena.

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
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

CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username citext NOT NULL,
  email citext NOT NULL,
  password_hash text NOT NULL,
  password_hash_algorithm varchar(20) NOT NULL DEFAULT 'bcrypt',
  role varchar(30) NOT NULL DEFAULT 'admin',
  status varchar(30) NOT NULL DEFAULT 'active',
  must_change_password boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  password_reset_token_hash text,
  password_reset_requested_at timestamptz,
  password_reset_expires_at timestamptz,
  last_login_at timestamptz,
  last_login_ip inet,
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  CONSTRAINT usuarios_username_uq UNIQUE (username),
  CONSTRAINT usuarios_email_uq UNIQUE (email),
  CONSTRAINT usuarios_role_ck CHECK (role IN ('admin', 'analyst', 'viewer')),
  CONSTRAINT usuarios_status_ck CHECK (status IN ('active', 'locked', 'disabled', 'pending_reset')),
  CONSTRAINT usuarios_failed_login_attempts_ck CHECK (failed_login_attempts >= 0),
  CONSTRAINT usuarios_email_not_blank_ck CHECK (btrim(email::text) <> ''),
  CONSTRAINT usuarios_username_not_blank_ck CHECK (btrim(username::text) <> '')
);

CREATE INDEX IF NOT EXISTS usuarios_status_idx
  ON public.usuarios (status);

CREATE INDEX IF NOT EXISTS usuarios_role_idx
  ON public.usuarios (role);

CREATE INDEX IF NOT EXISTS usuarios_last_login_at_idx
  ON public.usuarios (last_login_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS trg_usuarios_set_updated_at ON public.usuarios;

CREATE TRIGGER trg_usuarios_set_updated_at
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

COMMENT ON TABLE public.usuarios IS
  'Usuarios del sistema ADEX Palletizer. Base para autenticacion, analitica de acceso y recuperacion de contrasena.';

COMMENT ON COLUMN public.usuarios.username IS
  'Identificador corto legado/operativo. Permite bootstrap admin/admin sin sacrificar email corporativo.';

COMMENT ON COLUMN public.usuarios.email IS
  'Correo de acceso profesional futuro. Debe ser unico.';

COMMENT ON COLUMN public.usuarios.password_hash IS
  'Hash de contrasena. Nunca almacenar contrasenas en claro.';

COMMENT ON COLUMN public.usuarios.must_change_password IS
  'Obliga cambio de contrasena al primer ingreso del usuario bootstrap o al reset.';

COMMENT ON COLUMN public.usuarios.password_reset_token_hash IS
  'Hash del token temporal para recuperar contrasena. No almacenar token plano.';

INSERT INTO public.usuarios (
  username,
  email,
  password_hash,
  password_hash_algorithm,
  role,
  status,
  must_change_password,
  notes
)
VALUES (
  'admin',
  'admin',
  crypt('admin', gen_salt('bf', 12)),
  'bcrypt',
  'admin',
  'active',
  true,
  'Usuario bootstrap decoy para pruebas futuras de recuperar contrasena. Credenciales iniciales: admin / admin. El identificador de acceso inicial es admin.'
)
ON CONFLICT (username) DO NOTHING;

COMMIT;
