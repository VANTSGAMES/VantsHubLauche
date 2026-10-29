# VANTS GAMES — Arquitectura objetivo

> Documento norte de la plataforma. Define el destino recomendado; **no**
> implica que todos los servicios existan hoy. Regla principal: mejorar la
> interfaz sin romper las funciones existentes y separar frontend, backend y
> servicios de cada juego.

## 1 · Arquitectura general

```
VANTS EXPERIENCE          Landing cinematográfica · Rankings · Torneos · Perfiles · Tienda
                          GitHub Pages + Cloudflare Worker (espejo) · HTML · CSS · JS
                                    ⇅
VANTS API — BACKEND       Autenticación · Permisos · Validaciones · Reglas competitivas · API
                          Cloudflare Worker (vants-server/worker.js) · Servicios de dominio
                                    ⇅                      ⇅
PostgreSQL (Neon)          Integraciones
Usuarios · RR · Partidas   Auth0 · Discord · APIs de juegos · Webhooks
Torneos
                                    ⇅
VANTS HUB (Windows)        Electron · Presencia · Invitaciones · Apertura de juegos · Conexiones
```

## 2 · Estructura de carpetas objetivo

La existente evoluciona hacia esta estructura sin reconstruir todo de una vez.
**No duplicar páginas ni renombrar archivos sin comprobar enlaces.**

```
Vants/
├── index.html                  # Landing cinematográfica (composición, no lógica)
├── jugadores.html  rangos.html  torneos.html  torneo.html
├── perfil.html     equipo.html  clips.html    calendario.html
├── tienda.html     descargar.html  identidad.html  guia.html
├── terminos-de-servicio.html  politica-de-privacidad.html
├── assets/
│   ├── css/   arena.css · vants-shop.css · vants-cinematic.css ← Fase 1
│   │          (futuro: components.css · responsive.css)
│   ├── js/    arena.js · arena-live.js · auth0-config.js · vants-supervisor.js
│   │          vants-shop.js · vants-cinematic.js ← Fase 1
│   │          api-client.js · session.js · components.js ← Fase 2
│   ├── img/   brand/ · backgrounds/ · ranks/ · games/
│   └── fonts/
├── docs/      ARCHITECTURE.md ← este archivo · API_CONTRACTS.md · DEPLOYMENT.md
├── db/migrations/              # SQL versionado (workflow neon-migrate lo aplica)
├── vants-server/               # Backend: worker.js + public/ (espejo del sitio)
├── services/                   # Servicios Node (Express + Fastify): api-gateway · matchmaking-service
├── desktop-electron/           # VANTS HUB (launcher Windows)
├── bot/  monitor/  vlr-results/  android/
└── scripts/                    # Utilidades (faceit-xp.mjs, etc.)
```

## 3 · Arquitectura interna del frontend

`index.html` compone; la lógica vive en módulos por capas:

| Capa | Módulos | Estado |
|------|---------|--------|
| Cinematic Engine | `vants-cinematic.js` + `vants-cinematic.css` (intro, partículas, transiciones, profundidad) | ✅ Fase 1 |
| UI Components | arena.js (modales, drawer, toasts) | ✅ |
| Ranked UI | rangos, RR, tablas (arena.js + arena-live.js) | ✅ |
| Live UI | partidas, eventos, en vivo (`arena-live.js`, `/api/en-vivo`) | ✅ |
| Aplicación | `api-client.js` (red: timeout, reintentos, Bearer) · `session.js` (lectura de sesión Auth0 + eventos) · `components.js` (toast/confirm/badge opt-in) | ✅ Fase 2 |

Regla: los módulos nuevos se comunican por interfaces definidas y **no
modifican el funcionamiento interno de los módulos antiguos**. Ejemplo:
`vants-cinematic.js` solo anima; no toca RR, no autentica, no escribe DB.

## 4 · Backend: servicios y responsabilidades

El backend (Worker) es la autoridad de todas las operaciones competitivas.

| Servicio | Responsabilidad | Estado |
|----------|-----------------|--------|
| Auth | Identidad (Auth0 JWT), sesiones y permisos | ✅ |
| Players | Perfiles, estadísticas, cuentas vinculadas | ✅ |
| Ranked | Cálculo y registro de RR, rangos, temporadas | ✅ |
| Matchmaking | Colas, criterios, asignación | ✅ Fase 4 (Neon, migración 21) |
| Matches | Partidas, resultados y validación (series + FACEIT) | ✅ parcial |
| Tournaments | Inscripciones, equipos, brackets, premios | ✅ (migración 17) |
| Integrations | Eventos de juegos (FACEIT webhook+poller), Discord | ✅ |
| Payments | Membresías, pagos, confirmaciones (Stripe) | ✅ parcial |
| Admin | Gestión, sanciones, auditoría | 🔜 |

Además del Worker existen **servicios Node complementarios** en `services/`
(decisión del dueño: todos llevan `express` y `fastify` instalados):

| Servicio | Puerto | Framework | Estado |
|----------|--------|-----------|--------|
| api-gateway (`services/api-gateway/`) | 8080 | Express | ✅ base (healthz, /api/v1/status, rate limit, CORS) |
| matchmaking-service (`services/matchmaking-service/`) | 8081 | Fastify | ✅ Fase 4: cola persistida en Neon (mm_*), elegibilidad, emparejamiento atómico, reporte de resultado; memoria como fallback |

### Flujo de una partida competitiva

1. Jugador inicia sesión y busca partida
2. Matchmaking API valida elegibilidad (sub en `players`), encola en `mm_tickets`
   (un ticket activo por jugador y juego; TTL 10 min) y empareja de forma
   atómica (`mm_intentar_emparejar`: duo 1v1, team 5v5, SKIP LOCKED)
3. Adaptador del juego integra **solo** funciones compatibles con el juego
4. Resultado reportado por participantes (`mm_matches` `reportado`, primer
   reporte gana) y verificado contra fuente confiable — prevención de
   duplicados por claves únicas en cada capa
5. PostgreSQL + eventos: guardar, recalcular RR (`rr_before`/`rr_after`),
   actualizar ranking

No se promete acceso automático a partidas/invitaciones/resultados si la API
del juego no lo permite.

## 5 · Base de datos (Neon)

Árbol objetivo (adaptar a las tablas existentes; **no duplicar** users,
jugadores, equipos ni partidas):

```
users ── player_profiles · linked_game_accounts (vants_links) · sessions · subscriptions · user_settings
competitive_seasons ── ranked_ratings · rating_history · matches (match_players · match_results) · leaderboards
teams ── team_members · tournament_registrations · tournament_matches
tournaments ── tournament_rules · tournament_brackets · tournament_results
integrations ── external_events (faceit_webhook_events) · webhook_deliveries · audit_logs
```

El ranking conserva **historial de cambios de RR** con motivo, partida,
temporada y fecha (auditable y corregible).

## 6 · Seguridad y despliegue

- Frontend: GitHub Pages + espejo Cloudflare Worker; HTML/CSS/JS públicos.
- Backend: API protegida en el Worker; anti-bot, rate limiting, CORS propio.
- Base de datos: Neon, accesible solo desde el backend (RLS por rol para el
  acceso PostgREST directo).
- Autenticación: Auth0 (PKCE SPA); tokens validados en el servidor.
- Secretos: variables secretas del backend (Worker secrets / GH secrets);
  **nunca** credenciales de Neon ni claves privadas en archivos públicos.
- Cambios: ramas de Git, QA con navegador, publicación gradual.

## 7 · Orden de implementación

| Fase | Alcance | Estado |
|------|---------|--------|
| 1 — Cinemática | Portada, intro, efectos, transiciones, móvil; archivos actuales intactos | ✅ `vants-cinematic.*` |
| 2 — Frontend modular | api-client, sesión, componentes compartidos, manejo de errores | ✅ `api-client.js` · `session.js` · `components.js` |
| 3 — Backend y datos | Auth/permisos, esquemas Neon, rankings, torneos | ✅ base sólida |
| 4 — Competición real | Matchmaking, resultados verificables, historial RR, dedupe | ✅ migraciones 21–23 (cola + emparejamiento atómico + reporte → RR automático + historial; service v0.5.0 con 51 tests; HUB con BUSCAR PARTIDA) |
| 5 — Launcher | VANTS HUB Windows: presencia, matchmaking, invitaciones, apertura de juegos | ✅ 2.4.0 — HUB se ACTUALIZA SOLO (electron-updater + Releases con latest.yml; descarga silenciosa, instala al cerrar o reiniciar) + invitaciones HUB (migración 24: invitar por email, aceptar → en cola, el emparejador cruza) |
| 6 — Operación profesional | Monitorización, auditoría, pruebas automáticas, despliegues controlados | 🟡 en curso — **AGENTE VANTS** vivo, código y workflow en el **cuartel** `VANTSNET/flask-Agents` (ciclo cada 30 min: vigila web/launcher/BD/CI, actúa con guardas anti-bucle, memoria en Neon migración 25; este repo es cliente por `bot/` y `vantsbot`, doc `docs/AGENTE.md`) + CI de pruebas (tests.yml) + concurrency en despliegues |

Tras cada fase: verificar que Auth0, torneos, ranking y los scripts conectados
a Neon siguen funcionando **antes** de tocar la arquitectura del backend.
