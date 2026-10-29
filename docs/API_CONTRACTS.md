# API CONTRACTS — VANTS

> Contratos de los endpoints vivos de la plataforma. Todo JSON. Errores con
> forma `{ ok:false, error:{ message } }` donde aplica. Los endpoints del
> Worker exigen `Origin` propio (CORS) y tienen rate limit por IP.

## 1 · Worker principal (vants.vants.workers.dev)

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| GET | `/api/teams` | pública | `{ ok, source:"discord", count, teams:[…] }` |
| GET | `/api/gpr` | pública | `{ ok, source:"riot", total, regions:[…] }` (cache 1h) |
| GET | `/api/clips/featured` | pública | `{ ok, clips:[…] }` |
| GET | `/api/valorant/esports` | pública | agenda Valorant (upstream HenrikDev; fallback vlr.gg en la web) |
| GET | `/api/en-vivo` | pública | `{ ok, jugadores:[…] }` — hoy `base_no_disponible` (ver FASE3-REVISION §4) |
| GET | `/api/torneos/bracket?torneo=slug` | pública | bracket + inscritos |
| POST | `/api/torneos/inscribir` | JWT Auth0 | inscripción de equipo |
| POST | `/api/torneos/gestionar` | JWT Auth0 (admin) | bracket_sembrar, resultados, estados |
| POST | `/api/discord/notify` | origen propio | notificaciones del bot |
| POST | `/api/account/email-verify` · `/password-reset` | pública | envío de correo vía Auth0 |

## 2 · Worker FACEIT (vants-faceit-webhook.vants.workers.dev)

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| POST | `/api/webhooks/faceit` | header `X-VANTS-FACEIT-SECRET` (aliases: guiones bajos, `Faceit_webhook_secret`) **o** query `?secret=` | 200 `{ ok:true, stored:true }` · 401 sin/valor erróneo · 400 JSON inválido |
| GET/HEAD | `/api/webhooks/faceit` | ninguna | 200 `{ ok:true, ready:true }` (sondeo) |
| GET | `/healthz` | ninguna | 200 `{ ok:true, service, version:2 }` |

Guardado: `INSERT INTO faceit_webhook_events (event_type, payload)` — el
procesador (`faceit-xp.yml` cada 10 min + respaldo `scripts/faceit-xp.mjs`)
llama a `faceit_aplicar_resultado()` con dedupe por `UNIQUE faceit_match_id`.

## 3 · Matchmaking-service (Fase 4 · Node/Fastify · :8081)

Identidad: JWT de Auth0 RS256 verificado por JWKS en el servidor
(`services/matchmaking-service/auth.js`). Sin token → 401. Token de otro
jugador en un ticket → 403.

**Persistencia (migración 21)**: cola y partidas en Neon (`mm_tickets`,
`mm_matches`, `mm_match_players`). Sin `DATABASE_URL` postgres:// el servicio
arranca en modo memoria (degradado). Unicidad: **un ticket activo por
(sub, game)** — índice único parcial; reencolar devuelve el ticket vivo
(200 `reutilizado:true`) conservando su modo/región originales. Elegibilidad:
el sub debe existir en `players` (403 si no). Emparejamiento atómico
(`mm_intentar_emparejar`, SKIP LOCKED): tamaños duo=2 (1v1), team=10 (5v5);
el match nace `propuesto` al completarse el grupo. TTL del ticket: 10 min.
Errores de BD → 503 JSON limpio; `/healthz` nunca 500 (reporta `db:error`).

| Método | Ruta | Auth | Cuerpo / Respuesta |
|--------|------|------|--------------------|
| GET | `/healthz` | ninguna | `{ ok, service, version, store:"pg"\|"memoria", db:"ok"\|"error", queued }` |
| POST | `/api/v1/matchmaking/queue` | Bearer JWT | body `{ game:"valorant", mode:"duo"\|"team", region:"EU" }` → 201 `{ ok, data:{ ticket, reutilizado, game, mode, region, position, ttl_ms, expires_at, match_id } }` · 200 si reutiliza · 400 sin `game`/`mode` inválido · 403 no elegible |
| GET | `/api/v1/matchmaking/queue/:ticket` | Bearer JWT (dueño) | 200 `{ ok, data:{ ticket, game, mode, region, sub, status, enqueued_at, expires_at, match_id, position } }` · 404 · 403 |
| DELETE | `/api/v1/matchmaking/queue/:ticket` | Bearer JWT (dueño) | 200 `{ ok, data:{ removed } }` · 404 · 403 |
| GET | `/api/v1/matchmaking/matches/:id` | Bearer JWT (participante) | 200 `{ ok, data:{ match:{ id, game, mode, region, status, score_a, score_b, report_sub }, players:[{ sub, team }] } }` · 404 · 403 |
| POST | `/api/v1/matchmaking/matches/:id/result` | Bearer JWT (participante) | body `{ score_a, score_b }` (enteros ≥0, no ambos 0) → 200 `{ ok, data:{ match_id, status:"reportado", score_a, score_b } }` · 400 score inválido · 409 ya reportado · 403/404 |
| GET | `/api/v1/me` | Bearer JWT | 200 `{ ok, data:{ sub } }` |

Cierre de Fase 4 (T39): el reporte aplica RR al instante
(`mm_aplicar_resultado`, regla FACEIT) y marca `verificado`
(`verify_source=auto`); `rr_before/rr_after` quedan en
`mm_match_players` y el historial en la vista `mm_historial`.

### 3.1 · Capa SQL compartida (migraciones 21–24) — fuente única

El service Node y el HUB de escritorio comparten la MISMA lógica atómica en
SQL (PostgREST `POST /rpc/<fn>` para el HUB; conexión directa para el service):

| Función | Hace |
|---------|------|
| `mm_encolar(p_sub, p_game, p_mode, p_region, p_ttl_seg)` | valida elegibilidad + reutiliza ticket vivo + inserta (índice parcial anti-duplicados) |
| `mm_ticket_estado(p_ticket)` | posición FIFO / `matched`+match_id / `expired` (solo dueño). Migra 31: en `queued` devuelve también `cola_total` (vivos en la misma cola, incluido uno mismo) y `necesarios` (2/10) para que el HUB muestre "X/N en cola" y cuántos faltan |
| `mm_salir(p_ticket)` | cancela el ticket propio |
| `mm_reportar(p_match_id, p_sub, score_a, score_b)` | valida participante + reporta + aplica RR (mm_aplicar_resultado) en una transacción |
| `mm_aplicar_resultado(p_match_id)` | win +0.015 / draw +0.002 / loss −0.012, clamp [0.50,1.60], placement 0.95; rr_before/after; season stats vía faceit_stats_delta; idempotente |
| `mm_historial_de(p_sub, limite)` | historial RR propio (vista `mm_historial`) |
| `mm_invitar(p_to_email, p_game, p_mode, p_region)` | invitación HUB por email **o nick** (24 + 32): con `@` busca email, sin `@` busca username/display_name (case-insensitive); remitente excluido del lookup (si varios comparten email/nick gana el más reciente); anti-duplicado por pareja+juego, vigencia 10 min |
| `mm_invites_pendientes(p_limite)` | mis invitaciones recibidas + enviadas (24); expira vencidas al vuelo |
| `mm_responder_invite(p_id, p_aceptar)` | destino acepta → queda ENCOLADO con los parámetros vía `mm_encolar` (24); destino rechaza; remitente cancela |
| `mm_listo(p_match_id)` | ready-check (30): participante confirma "estoy listo"; PK (match_id, sub) = idempotente; rechaza `timeout` y `partida_anulada` |
| `mm_estado_ready(p_match_id)` | ready-check (30): `{ status, listos, total, deadline, vencido }` para el contador X/N del HUB (solo participantes) |
| `mm_anular_si_timeout(p_match_id)` | ready-check (30): UNA VEZ vencido el deadline (120 s desde el match) y sin confirmación completa, cualquier participante anula; lazy + transaccional (FOR UPDATE); los tickets quedan `matched` y cada HUB se re-encola solo |

Guard de identidad: si la llamada trae JWT (PostgREST), `p_sub` debe coincidir
con `request.jwt.claim.sub`; el service (conexión directa) pasa por diseño
porque ya validó su Bearer.

## 4 · API Gateway (Fase 2/4 · Node/Express · :8080)

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| GET | `/healthz` | ninguna | `{ ok, service, version, uptime }` |
| GET | `/api/v1/status` | ninguna | `{ ok, data:{ gateway, services } }` |

Rate limit: 120 req/min/IP (ventana fija en memoria). CORS: solo `ALLOW_ORIGIN`.

## 4-b · Agent-service (Agente VANTS · Node/Fastify · :8082)

Cerebro de control total. **El código de este servicio vive en el cuartel de
los agentes `VANTSNET/flask-Agents` (`services/agent-service`, doc
`docs/AGENTE.md` del cuartel); este repo es cliente.** Auth Bearer opcional con
`AGENT_TOKEN` (si está definido, todas las rutas `/api/v1/*` lo exigen;
`/healthz` nunca). Memoria en Neon (`agent_runs`/`agent_events`/
`agent_comandos`, migración 25) o RAM sin credenciales.

| Método | Ruta | Respuesta |
|--------|------|-----------|
| GET | `/healthz` | `{ ok, service:"agent-service", version, uptime, memoria:"pg"\|"memoria", cerebro:"reglas"\|"reglas+llm" }` |
| GET | `/api/v1/estado` | `{ ok, ultimo, incidentes[], cerebro }` |
| POST | `/api/v1/ciclo` | `{ ok, run_id, estado: UP\|DEGRADED\|DOWN, resumen, hallazgos[], acciones[] }` |
| POST | `/api/v1/comando` | body `{ texto, creado_por? }` → `{ ok, intencion, via, respuesta }` (NLU español; LLM si `AGENT_LLM_*`) |
| GET | `/api/v1/incidentes` | `{ ok, incidentes[] }` |
| POST | `/api/v1/incidentes/:id/resolver` | body `{ resolucion? }` → `{ ok, resuelto }` · 404 si no existe/ya cerrado |

Acciones automáticas (lista blanca): `redispatch_cloudflare`,
`redispatch_neon_migrate` (1 vez por SHA) y `rerun_fallidos` (1 vez por run),
con guarda persistida en `agent_events` (dedupe_key). Sin `GITHUB_TOKEN` las
acciones quedan propuestas. El bot de Discord expone lo mismo vía `/agente`
y los DMs salen de la tabla `agent_events` (`agent_bridge.py`).

## 5 · FACEIT Data API (open.faceit.com)

- Host oficial: `https://open.faceit.com/data/v4` (Bearer API key server-side).
- `api.faceit.com/data/v4` responde **500** con estas keys — no usarlo.
- Usos: `scripts/faceit-xp.mjs` (history/matches por jugador vinculado) y
  futuras integraciones de la Fase 4 (resultados verificables).
