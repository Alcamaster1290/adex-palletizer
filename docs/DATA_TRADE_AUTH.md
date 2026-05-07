# Data Trade Auth

Data Trade Auth es el proveedor central invisible de identidad para el ecosistema. No existe una cuenta visible separada llamada "Data Trade"; el usuario usa la misma cuenta en ADEX Palletizer, SisLoPe y futuros modulos.

## Principios

- Un solo login visible por aplicacion.
- ADEX mantiene su login normal y autentica contra `apps/api`.
- SisLoPe mantiene su login normal como fallback, pero puede recibir una sesion desde ADEX.
- No se pasan `email`, `password`, `accessToken` ni `refreshToken` por URL.
- Los tokens viven en memoria en frontend hasta implementar cookies `httpOnly` bajo dominio comun.

## Handoff ADEX A SisLoPe

Flujo:

```text
ADEX usuario autenticado
  -> POST /auth/handoff/create { targetModule: "sislope" }
  -> abrir VITE_SISLOPE_URL?handoff=<code>
  -> SisLoPe POST /auth/handoff/exchange { code, targetModule: "sislope" }
  -> sesion Data Trade normal en memoria
  -> history.replaceState limpia handoff de la URL
```

Seguridad:

- TTL: 60 segundos.
- Uso unico.
- El codigo se guarda en PostgreSQL solo como HMAC.
- El exchange valida expiracion, `used_at`, modulo destino y acceso del usuario al modulo.
- El exchange devuelve `accessToken`, `refreshToken`, `user`, `session` y `modules` por body HTTPS, no por URL.

## Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `GET /auth/modules`
- `GET /auth/session`
- `POST /auth/handoff/create`
- `POST /auth/handoff/exchange`

## Credencial Local

```text
admin@datatrade.local
ADEXPERU2026
```
