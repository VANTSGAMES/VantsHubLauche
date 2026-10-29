# DEPLOYMENT — Despliegue de VANTS

## Pipeline (automático, push a `main`)

```
git push origin main
  ├─ VANTS · pruebas automáticas   (tests.yml: matchmaking + neon_functions + agente + plataforma)
  ├─ Neon · migraciones de la base (neon-migrate.yml: db/migrations/*.sql en orden, idempotentes)
  ├─ Neon · deploy de funciones    (neon-deploy-functions.yml: linker, vantsdata, vantsbot, mm, …)
  └─ Cloudflare · deploy del Worker(cloudflare-deploy.yml: wrangler deploy con public/)
```

No hay paso manual. El Worker sirve el frontend desde `vants-server/public/` (binding ASSETS,
`run_worker_first: true`) y aplica seguridad/rutas/API antes de servir estáticos.

## Verificación post-deploy (método de la casa)

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"
for u in / /es/tournaments/valorant/upcoming/ /en/tournaments/cs2/archive/ /equipos /noticias /busqueda ; do
  curl -sS -A "$UA" -o /dev/null -w "$u -> %{http_code}\n" "https://vants.vants.workers.dev$u"
done
# Esperado: 200 en todas. Sin UA → 403 "Bloqueado" (bot-protection, correcto).
```

Si la API de GitHub está rate-limited, la prueba en vivo del workers.dev ES la evidencia del
deploy (decisión D7).

## Rollback

```bash
git revert <sha> && git push origin main   # el CI redeploya la versión anterior
```
Las migraciones son idempotentes y no destructivas; una reversión de código no requiere
revertir migración (las tablas `pt_*` quedan, sin afectar).

## Secretos necesarios (GitHub → Settings → Secrets → Actions)

CLOUDFLARE_API_TOKEN · NEON_API_KEY · FACEIT_API_KEY · FACEIT_CLIENT_ID ·
FACEIT_WEBHOOK_SECRET · HENRIKDEV_API_KEY · STEAM_API_KEY · AGENT_LLM_KEY ·
AGENT_LLM_URL · DISCORD_ID_APP · DISCORD_PUBLIC_KEY · VANTS_BOT_SECRET.
En el Worker: DISCORD_PUBLIC_KEY, VANTS_BOT_URL/VANTS_BOT_SECRET y (OPCIONAL desde la
auditoría del 20-oct) AUTH0_SPA_CLIENT_ID — client_id del SPA para los tickets de
verificación de email; si falta, el ticket se crea igual (el Management Token autoriza).
Observabilidad opcional del Worker: `SENTRY_DSN` envía errores a Sentry y
`SUPERVISOR_URL` reenvía eventos a la Neon Function `supervisor`. Configúralas como
secrets con `npx wrangler secret put SENTRY_DSN` y
`npx wrangler secret put SUPERVISOR_URL`; sin ellas, la ingesta local sigue activa.
En el núcleo del agente (cuartel `VANTSNET/flask-Agents`, `services/agent-service`):
AGENT_TOKEN (recomendado) — sin él la API /api/v1 queda CERRADA (503) salvo
AGENT_ALLOW_OPEN=1 explícito.
Ningún secreto vive en el repo (`.env.example` solo con placeholders).

## Base de datos

- Proyecto Neon: `square-surf-41242074`. Las migraciones `db/migrations/NN-*.sql` corren en
  orden en cada cambio de ese directorio (idempotentes, con inventario final en el log).
- Migración 28: tablas `pt_games/pt_torneos/pt_teams/pt_matches/pt_articulos` + seed DEMO
  etiquetado. Reversible con los `DROP TABLE IF EXISTS` documentados en su cabecera.

## FACEIT · sync de datos reales (T53)

Workflow `faceit-sync.yml`: cron diario 05:17 UTC + ejecución manual (con inputs
`juegos` y `dry`). Ejecuta `scripts/sincronizar-faceit.mjs` con `FACEIT_API_KEY` y
`DATABASE_URL` de secrets: torneos/equipos/partidas REALES de FACEIT entran en pt_*
con `source='faceit'` e `is_demo=false` (UPSERT idempotente por source+external_id).
Honestidad de salidas: sin key → exit 0 con aviso; sin DATABASE_URL → exit 2;
errores de la API → exit 3 (rojo visible). Requiere migraciones 28 y 29 aplicadas.

## Dominio propio (pendiente del dueño)

`vantsgg.com` está preparado en `wrangler.toml` (comentado). Al activar la zona en
Cloudflare: descomentar las rutas y añadir el dominio a `SITE_ORIGINS` del Worker.
