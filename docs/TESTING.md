# TESTING — Cómo probar la plataforma VANTS

## Suites automatizadas (Node, sin dependencias externas)

| Suite | Comando | Cobertura | Estado esperado |
|---|---|---|---|
| Plataforma de torneos | `node scripts/test_plataforma.js` | Lógica pura compartida con el Worker: validación de query, clasificación de estados, orden, paginación, fechas es/en, render XSS-safe + **integración real** con el proxy (si hay red; si no, `~skip` honesto) | **90** ✓ · 0 ✗ |
| Matchmaking (fase 4) | `node scripts/test_mm_fase4.js` | Cola, emparejamiento, RR | 54 ✓ |
| Matchmaking Neon | `node scripts/test_mm_neon.js` | Funciones serverless | 16 ✓ |
| Vantsbot Discord | `node scripts/test_vantsbot.js` | Interactions, puente | 36 ✓ |
| Auditoría de enlaces | `node scripts/audit_enlaces.js` | 33 páginas, crawler interno (espejo completo) | **752** ✓ · 0 rotos |
| Webapp Astro (islas) | `cd webapp && npx astro check && npm run build` | Tipado + build de la home compilada (islas React/Vue) | 0 errores · bundles `_astro/` byte-idénticos |
| Docker | `docker compose build` | api-gateway (Express :8080) y matchmaking (Fastify :8081): multi-stage `node:24-alpine`, `USER node` | build OK · healthcheck `/healthz` en ambos |
| MCP | `node mcp/server.mjs` (smoke JSON-RPC en `fullstack.yml`) | `initialize` + `tools/list` | 4 tools de solo lectura (estado_db, torneos, jugadores, partidos) |

Total de asserts: **196** verdes en las 4 suites Node/Bun. Los **173** asserts del agente (83 + 60 + 30) corren en el cuartel `VANTSNET/flask-Agents`.

## CI (GitHub Actions — `tests.yml`)

Cada push a `main` que toque `services/**`, `scripts/**`, `vants-server/**`,
`neon-functions/**` o `db/**` ejecuta 4 jobs: matchmaking, neon_functions,
**plataforma** y **e2e** (los tests del agente corren en el cuartel
`VANTSNET/flask-Agents`). Rojo = no confiar en el despliegue.

## Pruebas E2E manuales (navegador)

### Local
```bash
cd vants-server && npx wrangler dev --port 8787
# en otra terminal: navegar con el navegador o agent-browser:
#   http://127.0.0.1:8787/
#   http://127.0.0.1:8787/es/tournaments/valorant/upcoming/
#   http://127.0.0.1:8787/en/tournaments/cs2/archive/
#   http://127.0.0.1:8787/equipos · /noticias · /busqueda?q=demo
```

### Producción (tras cada push)
1. `curl -A "Mozilla/5.0 …" -o /dev/null -w "%{http_code}" https://vants.vants.workers.dev/<ruta>` — las rutas críticas deben dar 200 (sin UA de navegador el bot-protection da 403 "Bloqueado": es lo esperado).
2. Navegador real: tabs de estado (URL cambia sin recargar; back/forward restaura), ficha de torneo, búsqueda, cambio de idioma ES/EN, móvil 390px sin overflow horizontal.
3. Consola sin errores rojos; los avisos "Neon no disponible" con red bloqueada son del entorno local.

## E2E con Playwright (T53 · F13)

Suites: `tests/e2e/plataforma.spec.js` (12) + `tests/e2e/home-fullstack.spec.js` (3:
isla React, bundles `_astro`, estructura del home compilado) · config: `playwright.config.js`.
Corre contra PRODUCCIÓN por defecto (`VANTS_E2E_URL` para apuntar a otro entorno),
con dos proyectos: desktop 1280×800 y móvil 390×844.

```bash
npm install                 # @playwright/test ya está en devDependencies
npx playwright test         # 15 tests (12 plataforma + 3 home fullstack): rutas, fichas,
                            # calendario, búsqueda, i18n, overflow, islas
npx playwright test --project=chromium-desktop   # solo desktop
VANTS_E2E_URL=http://localhost:8787 npx playwright test   # contra wrangler dev
```

Contrato de la suite: las páginas SIEMPRE deben terminar en datos (`sf-mrow`/`pf-card`/
`pf-ficha`) o en estado honesto (`pf-empty`/`pf-error`) — nunca en blanco. Los datos demo
deben mostrar su chip DEMO. En CI hay un job `e2e` (retries 2, espera hasta 6 min al deploy).

## Sincronización FACEIT (T53 · F8)

```bash
npm run sync:faceit:dry    # previsualiza sin escribir (no necesita DATABASE_URL)
npm run sync:faceit        # UPSERT real en Neon (requiere FACEIT_API_KEY + DATABASE_URL)
npm run audit:enlaces      # crawler interno (752 enlaces / 0 rotos)
```

## Qué cubre cada criterio

Ver `product/ACCEPTANCE_CRITERIA.md` (AC1–AC41) con la evidencia asociada.
La suite de la plataforma cubre AC9–AC15 (validación/errores/paginación) a nivel unitario;
AC1–AC7 y AC19–AC22 se verifican con wrangler dev + navegador; AC23–AC27 con el HTML
servido (curl + navegador); AC36–AC39 en CI y espejo ×3 (hashes).
