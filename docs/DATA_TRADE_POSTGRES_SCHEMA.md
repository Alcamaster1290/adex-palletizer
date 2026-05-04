# Data Trade PostgreSQL Schema

## ORM y migraciones

El backend comun usa Drizzle con PostgreSQL. La primera migracion vive en `apps/api/src/db/migrations` y crea tablas core en el schema `data_trade`, sin modificar las tablas legacy `public.usuarios` o `public.auth_sessions` existentes de ADEX.

## Tablas core

- `data_trade.users`: identidad comun, email, username, password hash opcional, estado y ultimo acceso.
- `organizations`: organizaciones o workspaces comerciales.
- `roles`: catalogo de roles (`admin`, `owner`, `analyst`, `viewer`).
- `memberships`: relacion usuario-organizacion-rol.
- `auth_accounts`: cuentas externas o credenciales locales.
- `auth_sessions`: sesiones centrales con hash de refresh token.
- `modules`: catalogo de modulos (`sislope`, `adex-palletizer`, `datatrade-analytics`, `alvin`).
- `user_module_access`: permisos por modulo.
- `projects`: espacios/casos guardados por usuario u organizacion.
- `palletizer_runs`: calculos de paletizacion/contenedores.
- `map_sessions`: sesiones de uso de mapa SisLoPe.
- `search_queries`: busquedas realizadas.
- `uploaded_files`: metadatos de archivos cargados, sin binarios en PostgreSQL.
- `data_sources`: fuentes de datos y datasets.
- `events`: tracking interno.
- `audit_logs`: auditoria de seguridad/administracion.
- `admin_notes`: notas administrativas sobre usuarios.
- `user_flags`: flags de usuario.

## Privacidad

- No guardar IP plana en `events`; se guarda `ip_hash`.
- No guardar passwords en claro. `password_hash` debe venir hasheado.
- Los uploads guardan metadatos y referencia externa; archivos grandes deben ir a object storage.

## Compatibilidad

Las tablas legacy `public.usuarios`, `public.auth_sessions` y `public.auth_audit_log` se conservan hasta una migracion especifica de auth. La fase 1 no las modifica.
