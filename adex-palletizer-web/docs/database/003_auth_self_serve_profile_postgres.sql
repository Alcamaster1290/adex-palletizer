-- ADEX Palletizer
-- Captura minima de traccion para registro self-serve.
-- Requiere haber ejecutado:
--   - docs/database/001_auth_usuarios_postgres.sql
--   - docs/database/002_backend_foundation_postgres.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.usuario_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  company_name text NOT NULL,
  use_case varchar(40) NOT NULL,
  monthly_volume_band varchar(30) NOT NULL,
  signup_source varchar(30) NOT NULL DEFAULT 'self_serve',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT usuario_profiles_full_name_not_blank_ck CHECK (btrim(full_name) <> ''),
  CONSTRAINT usuario_profiles_company_name_not_blank_ck CHECK (btrim(company_name) <> ''),
  CONSTRAINT usuario_profiles_use_case_ck CHECK (
    use_case IN (
      'single_palletization',
      'multi_box_mixing',
      'container_loading',
      'general_exploration'
    )
  ),
  CONSTRAINT usuario_profiles_monthly_volume_band_ck CHECK (
    monthly_volume_band IN (
      'lt_10',
      'between_10_50',
      'between_51_200',
      'gt_200'
    )
  ),
  CONSTRAINT usuario_profiles_signup_source_ck CHECK (
    signup_source IN ('self_serve', 'admin_seed', 'sales_assisted')
  )
);

CREATE INDEX IF NOT EXISTS usuario_profiles_company_name_idx
  ON public.usuario_profiles (company_name);

CREATE INDEX IF NOT EXISTS usuario_profiles_use_case_idx
  ON public.usuario_profiles (use_case);

DROP TRIGGER IF EXISTS trg_usuario_profiles_set_updated_at ON public.usuario_profiles;

CREATE TRIGGER trg_usuario_profiles_set_updated_at
BEFORE UPDATE ON public.usuario_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

COMMENT ON TABLE public.usuario_profiles IS
  'Perfil comercial minimo por usuario para capturar traccion del registro self-serve.';

COMMENT ON COLUMN public.usuario_profiles.use_case IS
  'Caso de uso principal declarado durante el alta.';

COMMENT ON COLUMN public.usuario_profiles.monthly_volume_band IS
  'Banda de volumen declarada para calificacion comercial inicial.';

COMMIT;
