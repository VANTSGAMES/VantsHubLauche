# VANTS GAMES — Arena competitiva · Plataforma de esports

Plataforma de esports estilo torneos (referencia de UX: strafe.com): calendario de torneos
por juego y estado, partidas en vivo, ranking, brackets, equipos, jugadores, noticias,
búsqueda, tienda y membresías — con login **Auth0**, datos en **Neon Postgres** y despliegue
automático en **Cloudflare Workers**.

**Web:** https://vants.vants.workers.dev
**Plataforma de torneos:** https://vants.vants.workers.dev/es/tournaments/valorant/upcoming/

## Estructura

```
├── index.html                  ← home (layout strafe: tabs EN CURSO/PRÓXIMOS/ARCHIVO)
├── equipos.html                ← equipos de la arena (API /api/teams)
├── noticias.html, noticia.html ← noticias + ficha de artículo (API /api/articles)
├── busqueda.html               ← búsqueda global (API /api/search)
├── torneos.html / torneo.html  ← inscripción real + ficha de torneo
├── partidos/ranking/jugadores/llaves/clips/membresías/tienda/…
├── research/                   ← F1: análisis real de la referencia (strafe.com)
├── product/                    ← F2: requisitos, flujos, criterios de aceptación
├── architecture/               ← F3: sistema, esquema BD, API, seguridad
├── PROJECT_STATUS.md           ← estado vivo de la misión (fases con evidencia)
├── IMPLEMENTATION_PLAN.md      ← plan de 16 fases
├── DECISIONS.md                ← decisiones técnicas y sus motivos
├── db/migrations/              ← SQL idempotente (01…29; 28 = plataforma pt_*, 29 = pt_players)
├── vants-server/
│   ├── worker.js               ← Worker Cloudflare: seguridad, rutas /es|en/tournaments/…,
│   │                              API pública JSON, Discord events, inscripciones
│   ├── plataforma-core.js      ← lógica pura compartida Worker↔tests (ESM)
│   └── public/                 ← frontend servido (espejo ×3 con raíz y public/)
├── neon-functions/             ← vantsdata (proxy lectura), mm, vantsbot, stripe…
├── services/                   ← matchmaking (el agente vive en el cuartel flask-Agents)
├── bot/                        ← bot ORION de Discord (Python)
├── desktop-electron/           ← HUB/launcher Electron con auto-update
├── scripts/                    ← tests (test_plataforma, test_mm, …), auditoría,
│                                  build-webapp.mjs (sincroniza/verifica el espejo ×3),
│                                  scraper_vlr.py (vlr.gg → vlr_matches, idempotente)
├── docs/                       ← TESTING.md, DEPLOYMENT.md, content-island.md, …
├── webapp/                     ← Astro 7: home compilada + islas React (Explore) y
│                                  Vue+Three (Emblema3D, IntroJett) — ver docs/content-island.md
├── mcp/                        ← server MCP stdio sin dependencias (4 tools)
├── docker-compose.yml          ← api-gateway (Express :8080) + matchmaking (:8081)
└── .github/workflows/          ← tests, neon-migrate, neon-deploy-functions,
                                   cloudflare-deploy, fullstack, faceit-*,
                                   electron, android (deploy-prod en cola; actions SHA-pinned)
```

## Agentes: el cuartel es flask-Agents

**Anuncio del ecosistema:** el cuartel de los agentes es
[`VANTSNET/flask-Agents`](https://github.com/VANTSNET/flask-Agents). Ahí vive
el código de todos los agentes, los viejos y los nuevos: el núcleo del Agente
VANTS (`services/agent-service`), sus tests (83 + 60 + 30 asserts), el ciclo
`agente.yml` cada 30 minutos, el puente de ORION, las migraciones 25 y 26 y la
web VANTS AI (https://vants-ai.vercel.app/).

Este repo quedó limpio de código de agentes: el bot VANTCALL (`bot/`) es
**cliente** del cuartel por las colas de Neon (`agent_comandos`,
`agent_events`, `agent_runs`), y la Neon Function `vantsbot` entrega `/agente`
y los DMs. Detalles: `docs/AGENTE.md`.

## Requisitos previos

- Node 20+ (para tests y wrangler).
- Cuenta Cloudflare con el Worker `vants` configurado (deploy automático por CI).
- Proyecto Neon con las migraciones aplicadas (CI las aplica en cada cambio).
- Opcional en local: `wrangler` (`npm i -g wrangler` o usar el de `vants-server`).

## Instalación y arranque local

```bash
# clonar y entrar
git clone https://github.com/feispla/Vants.git && cd Vants

# servidor local del Worker (sirve el frontend + API con las rutas reales)
cd vants-server
npm install
npx wrangler dev --port 8787
# → http://127.0.0.1:8787
```

No hay build del frontend: los archivos estáticos se sirven tal cual (espejo ×3:
raíz / `public/` / `vants-server/public/` — mantener los tres sincronizados).

## Variables de entorno

Todo lo sensible va en GitHub Secrets / Secretos del Worker (ver `docs/DEPLOYMENT.md`).
Referencia sin secretos: `vants-server/.env.example`, `bot/.env.example`,
`services/*/.env.example`. El Worker NO guarda credenciales de la base: lee por el proxy
público `vantsdata` y reenvía el JWT del usuario cuando hay sesión.

## Ejecución de pruebas

```bash
node scripts/test_plataforma.js    # 90 asserts (lógica de la plataforma + integración)
node scripts/test_mm_fase4.js      # 54 asserts (matchmaking)
node scripts/test_vantsbot.js      # 36 asserts · test_mm_neon.js 16
node scripts/audit_enlaces.js      # crawler interno (752 enlaces, 0 rotos)
# total de asserts: 196 verdes en las 4 suites
# los 173 asserts del agente (83 + 60 + 30) corren en el cuartel: VANTSNET/flask-Agents
# webapp Astro (islas): tipos + build reproducible (bundles _astro byte-idénticos)
cd webapp && npx astro check && npm run build && cd ..
# Docker: api-gateway (Express :8080) + matchmaking (Fastify :8081), multi-stage USER node
docker compose build
# MCP: server stdio sin dependencias, 4 tools de solo lectura (smoke en fullstack.yml)
node mcp/server.mjs
# suite completa: ver docs/TESTING.md
```

## Migraciones

Las aplica el CI (`neon-migrate.yml`) en orden por nombre de archivo; son idempotentes.
En manual: ejecutar los `db/migrations/NN-*.sql` en orden contra la rama principal de Neon.

## Integraciones externas

- **Auth0** (`vants.eu.auth0.com`): login SPA; el JWT decide RLS en Neon.
- **Neon Postgres + Data API/proxy**: torneos, equipos, jugadores, artículos, presencia.
- **FACEIT Data API** (`FACEIT_API_KEY`): pipeline de resultados/RR (webhook + poller).
- **Discord**: events endpoint del Worker (Ed25519) + bot ORION.
- **Stripe**: membresías (checkout + webhook en Neon Functions).
- **vlr.gg/HenrikDev**: agenda esports Valorant y panel EN VIVO.

## Despliegue

Push a `main` → CI (tests → migraciones → funciones → Worker). Detalles y verificación
post-deploy: `docs/DEPLOYMENT.md`. Rollback: `git revert` + push.

## Limitaciones conocidas

- Datos del calendario: mientras no existan torneos reales publicados, la plataforma muestra
  la semilla **DEMO claramente etiquetada** (chip DEMO + prefijo "DEMO ·"); nunca presenta
  datos ficticios como reales.
- i18n: la interfaz está traducida es/en; el contenido editorial (artículos) se publica en
  el idioma en que el equipo lo escriba.
- Sin analítica/publicidad de terceros por decisión de producto (`DECISIONS.md` D6).
