// ============================================
// vantsbot — Neon Function
// Mando del Agente VANTS por Discord, sin servidor de pago.
//
// Sustituye el hosting en Railway/Render del bot (discord.py) para TODO lo
// que importa para el control: los comandos /agente y el puente de DMs.
// No usa Gateway (websocket residente = caro): 100% HTTP.
//
//   POST /            → Interactions endpoint de Discord (firma Ed25519)
//                       /agente estado|informe|incidentes|resolver|comando
//   POST /tarea       → ciclo del puente (migra 25): DMs de incidentes
//                       (agent_events.notificado=false) y respuestas
//                       (agent_comandos.entregado=false). La dispara
//                       agente.yml cada 30 min y cualquier integración.
//   POST /setup       → registra /agente como comando global (REST)
//   POST /evento-discord → guarda eventos de la app de Discord (entitlements,
//                       app autorizada...) reenviados por el Worker (que ya
//                       verificó la firma Ed25519 del Developer Portal) en
//                       web_events (migra 01) + DM de compras al dueño.
//   GET  /salud       → diagnóstico de configuración (sin secretos)
//
// Autenticación de /tarea y /setup: cabecera x-vants-bot = VANTS_BOT_SECRET
// (>= 32 caracteres, comparación timing-safe).
//
// Tablas que reutiliza (migración 25, nada duplicado):
//   agent_runs · agent_events · agent_comandos · agent_resumen
// Misma lógica/SQL que bot/commands/agente.py + bot/agent_bridge.py.
// ============================================

import { Pool } from 'pg';
import { timingSafeEqual, createPublicKey, verify as cryptoVerify, createHash } from 'node:crypto';

const API = 'https://discord.com/api/v10';
const DM_POR_DEFECTO = '1532612429295521930'; // dueño (mismo default que agent_bridge.py)
const PRESUPUESTO_MS = 2200; // Discord exige respuesta < 3s; con margen para el followup

const COLORES_ESTADO: Record<string, number> = { UP: 0x3ddc84, DEGRADED: 0xffb547, DOWN: 0xed4245 };
const COLORES_SEV: Record<string, number> = { info: 0x3ddc84, warn: 0xffb547, error: 0xed4245, critical: 0xed4245 };
const ICONO_SEV: Record<string, string> = { critical: '🔴', error: '🟠', warn: '🟡', info: '⚪' };

type Fila = Record<string, unknown>;
type Embed = {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
};
type Salida = { embeds?: Embed[]; content?: string };
type ResultadoDapi = { ok: boolean; status: number; data: unknown };
type Dependencias = {
  env: Record<string, string | undefined>;
  pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Fila[] }> };
  fetch: typeof fetch;
  saltarFirma: boolean;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-signature-ed25519, x-signature-timestamp, x-vants-bot',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Limpieza anti-ping (igual que _txt de agent_bridge.py / clip de discord-notify)
function txt(valor: unknown, limite = 200): string {
  let t = String(valor ?? '');
  if (valor === null || valor === undefined || valor === '') t = '—';
  t = t.replace(/@(everyone|here)/g, '@\u200b$1');
  return t.slice(0, limite);
}

// El primer segmento del token de bot ES el application id (base64url)
function appIdDeToken(token: string): string | null {
  try {
    const seg = String(token || '').split('.')[0] ?? '';
    const id = Buffer.from(seg, 'base64url').toString('utf8');
    return /^\d{17,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

// Verificación Ed25519 oficial de Discord (sin dependencias: node:crypto)
function verificarFirma(publicKeyHex: string, timestamp: string, body: string, firmaHex: string): boolean {
  try {
    if (!/^[0-9a-fA-F]{64}$/.test(firmaHex)) return false;
    const key = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(publicKeyHex, 'hex').toString('base64url') },
      format: 'jwk',
    });
    const mensaje = Buffer.concat([Buffer.from(timestamp, 'utf8'), Buffer.from(body, 'utf8')]);
    return cryptoVerify(null, mensaje, key, Buffer.from(firmaHex, 'hex'));
  } catch {
    return false;
  }
}

function autorizado(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header || header.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(header, 'utf8'), Buffer.from(secret, 'utf8'));
  } catch {
    return false;
  }
}

// Llamada REST a Discord (con o sin auth de bot — los followups no la llevan)
async function dapi(
  f: typeof fetch,
  token: string | null,
  method: string,
  path: string,
  payload?: unknown
): Promise<ResultadoDapi> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'VANTS-Bot (https://vants.workers.dev, 1.0)',
  };
  if (token) headers.Authorization = `Bot ${token}`;
  try {
    const r = await f(API + path, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    let data: unknown = null;
    try {
      data = await r.json();
    } catch {
      /* respuestas vacías */
    }
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: String(e) };
  }
}

async function abrirDM(f: typeof fetch, token: string, destinatario: string): Promise<{ ok: boolean; id?: string; status: number }> {
  const r = await dapi(f, token, 'POST', '/users/@me/channels', { recipient_id: destinatario });
  const id = (r.data as { id?: string } | null)?.id;
  return r.ok && id ? { ok: true, id, status: r.status } : { ok: false, status: r.status };
}

// ── SQL (mismas consultas que bot/commands/agente.py + agent_bridge.py) ────
const SQL_ULTIMO_RUN =
  'SELECT estado_global, resumen, started_at, fuente, modo, error FROM agent_runs ORDER BY id DESC LIMIT 1';
const SQL_INCIDENTES = (limite: number): [string, unknown[]] => [
  'SELECT id, severity, titulo, accion_sugerida, created_at FROM agent_events WHERE estado = \'abierto\' ORDER BY ' +
    "CASE severity WHEN 'critical' THEN 0 WHEN 'error' THEN 1 WHEN 'warn' THEN 2 ELSE 3 END, id DESC LIMIT " +
    Number(limite),
  [],
];
const SQL_RESOLVER =
  "UPDATE agent_events SET estado='resuelto', resolucion='resuelto por el dueño (Discord)', " +
  'resolved_at=now(), updated_at=now() WHERE id=$1 AND estado IN (\'abierto\',\'gestionando\') RETURNING id';
const SQL_COMANDO = 'INSERT INTO agent_comandos (texto, creado_por) VALUES ($1, $2) RETURNING id';
const SQL_RESUMEN = 'SELECT * FROM agent_resumen';
const SQL_PEND_INCIDENTES =
  'SELECT id, kind, severity, titulo, accion_sugerida, created_at FROM agent_events ' +
  "WHERE notificado = false AND estado = 'abierto' AND severity IN ('warn','error','critical') ORDER BY id LIMIT 10";
const SQL_PEND_RESPUESTAS =
  'SELECT id, texto, respuesta, estado FROM agent_comandos ' +
  "WHERE entregado = false AND estado IN ('hecho','error') ORDER BY id LIMIT 10";

// ── Embeds (espejo exacto de commands/agente.py) ───────────────────────────
function embedEstado(run: Fila | null, incidentes: Fila[]): Embed {
  const estado = String(run?.estado_global ?? 'DESCONOCIDO');
  const e: Embed = {
    title: 'Agente VANTS · estado',
    description: run
      ? `Estado global: **${estado}**`
      : 'El agente aún no ha corrido (espera al ciclo del cuartel flask-Agents).',
    color: COLORES_ESTADO[estado] ?? 0x5865f2,
  };
  if (run) {
    e.fields = [
      { name: 'Ultimo ciclo', value: txt(String(run.started_at ?? '—'), 16), inline: true },
      { name: 'Fuente', value: `${txt(run.fuente, 12)} / ${txt(run.modo, 12)}`, inline: true },
    ];
    if (run.resumen) e.fields.push({ name: 'Resumen', value: txt(run.resumen, 200), inline: false });
    if (run.error) e.fields.push({ name: 'Error', value: txt(run.error, 200), inline: false });
  }
  e.fields = e.fields ?? [];
  if (incidentes.length) {
    e.fields.push({
      name: `Incidentes abiertos (${incidentes.length})`,
      value: incidentes
        .map((i) => `${ICONO_SEV[String(i.severity)] ?? '·'} \`#${i.id}\` ${txt(i.titulo, 90)}`)
        .join('\n')
        .slice(0, 1000),
      inline: false,
    });
  } else {
    e.fields.push({ name: 'Incidentes abiertos', value: 'Ninguno ✅', inline: false });
  }
  e.footer = { text: 'Agente VANTS · /agente comando <orden> para actuar' };
  return e;
}

function embedIncidenteDM(row: Fila): Embed {
  const sev = String(row.severity ?? 'info');
  const e: Embed = {
    title: `Agente VANTS · [${sev.toUpperCase()}] ${txt(row.kind, 40)}`,
    description: txt(row.titulo, 250),
    color: COLORES_SEV[sev] ?? COLORES_SEV.info,
  };
  if (row.accion_sugerida) e.fields = [{ name: 'Accion sugerida', value: txt(row.accion_sugerida, 80) }];
  e.footer = { text: `incidente #${row.id} · /agente resolver ${row.id}` };
  return e;
}

// ── Procesado de /agente (type 2 APPLICATION_COMMAND) ──────────────────────
async function procesarAgente(body: Fila, dep: Dependencias): Promise<Salida> {
  const data = (body.data as Fila | undefined) ?? {};
  const primero = (data.options as Fila[] | undefined)?.[0] ?? {};
  const sub = String(primero.name || 'estado');
  const opciones = (primero.options as Fila[] | undefined) ?? [];
  const opt = (n: string): unknown => opciones.find((o) => o.name === n)?.value;

  if (sub === 'estado' || sub === 'informe') {
    const run = (await dep.pool.query(SQL_ULTIMO_RUN, [])).rows[0] ?? null;
    const limite = sub === 'informe' ? 15 : 5;
    const [sqlInc, paramsInc] = SQL_INCIDENTES(limite);
    const incidentes = (await dep.pool.query(sqlInc, paramsInc)).rows;
    if (sub === 'estado') return { embeds: [embedEstado(run, incidentes)] };
    // informe: diagnóstico completo en texto (como el /informe del bot python)
    if (!run) return { content: 'El agente aún no ha corrido. El ciclo corre desde el cuartel flask-Agents.' };
    const lineas = [`Estado global: ${run.estado_global}`];
    if (run.resumen) lineas.push(String(run.resumen));
    for (const i of incidentes) lineas.push(`#${i.id} [${i.severity}] ${txt(i.titulo, 80)}`);
    let extra = '';
    try {
      const r = (await dep.pool.query(SQL_RESUMEN, [])).rows[0];
      if (r) extra = `\nresumen: abiertos=${r.incidentes_abiertos} graves=${r.incidentes_graves} comandos_pend=${r.comandos_pendientes}`;
    } catch {
      /* vista opcional */
    }
    return { content: '```\n' + (lineas.join('\n') + extra).slice(0, 1800) + '\n```' };
  }

  if (sub === 'incidentes') {
    const [sqlInc, paramsInc] = SQL_INCIDENTES(15);
    const lista = (await dep.pool.query(sqlInc, paramsInc)).rows;
    if (!lista.length) return { content: 'Sin incidentes abiertos ✅' };
    const cuerpo = lista
      .map((i) => `${ICONO_SEV[String(i.severity)] ?? '·'} \`#${i.id}\` ${txt(i.titulo, 90)}`)
      .join('\n')
      .slice(0, 1800);
    return { content: '**Incidentes abiertos**\n' + cuerpo };
  }

  if (sub === 'resolver') {
    const id = Number(opt('id_incidente') ?? 0);
    const fila = (await dep.pool.query(SQL_RESOLVER, [id])).rows[0];
    if (fila) return { content: `Incidente \`#${id}\` resuelto ✅` };
    return { content: `No encontré un incidente abierto \`#${id}\`.` };
  }

  if (sub === 'comando') {
    const texto = String(opt('texto') ?? '').slice(0, 500);
    const miembro = (body.member as Fila | undefined)?.user as Fila | undefined;
    const usuario = String(miembro?.id ?? (body.user as Fila | undefined)?.id ?? 'desconocido');
    await dep.pool.query(SQL_COMANDO, [texto, `discord:${usuario}`]);
    return {
      content:
        'Orden en cola para el agente ✅ La procesará en su próximo ciclo (máx. ~30 min) y te llegará por DM.\n' +
        '_(Ruta Neon Functions: sin hosting de pago.)_',
    };
  }

  return { content: `Subcomando \`${sub}\` no reconocido. Usa estado, informe, incidentes, resolver o comando.` };
}

// Definición del comando global (espejo de register_commands.py)
export function definicionComandoAgente(): Record<string, unknown> {
  return {
    name: 'agente',
    description: 'Control del Agente VANTS (web, launcher, BD, CI)',
    options: [
      { name: 'estado', description: 'Ultimo ciclo del agente + incidentes abiertos', type: 1 },
      { name: 'informe', description: 'Diagnostico completo del agente', type: 1 },
      { name: 'incidentes', description: 'Lista los incidentes abiertos', type: 1 },
      {
        name: 'resolver',
        description: 'Marca un incidente como resuelto',
        type: 1,
        options: [{ name: 'id_incidente', description: 'Numero del incidente (ver /agente incidentes)', type: 4, required: true }],
      },
      {
        name: 'comando',
        description: 'Orden libre al agente (ej: despliega la web)',
        type: 1,
        options: [{ name: 'texto', description: 'Lo que quieres que haga el agente', type: 3, required: true }],
      },
    ],
  };
}

// ── Eventos de la app de Discord (el Worker los reenvía ya verificados) ────
// El Worker (https://vants.vants.workers.dev/api/discord/events) valida la
// firma Ed25519 del Developer Portal y reenvía el payload aquí; se guarda en
// web_events (migración 01, cero duplicación) y las compras/instalaciones
// avisan por DM al dueño. Dedupe: event_id del Worker o sha256 del payload.
const TIPOS_DM = new Set(['ENTITLEMENT_CREATE', 'ENTITLEMENT_UPDATE', 'APPLICATION_AUTHORIZED']);
const SQL_GUARDAR_EVENTO =
  'INSERT INTO web_events (event_id, kind, severity, page, payload) ' +
  'VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (event_id) DO NOTHING RETURNING id';

async function guardarEventoDiscord(dep: Dependencias, body: Fila | null): Promise<Record<string, unknown>> {
  if (!body || typeof body !== 'object') return { ok: false, error: { message: 'bad_request' } };
  const payload = ((body.payload as Fila | undefined) ?? body) as Fila;
  const data = (payload.data as Fila | undefined) ?? {};
  const tipo = String(data.type ?? payload.type ?? 'evento').slice(0, 60);
  let eventoId = String(body.evento_id ?? '').slice(0, 120);
  if (!eventoId) {
    eventoId = 'discord:' + createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 40);
  }
  let guardado = false;
  try {
    guardado = (await dep.pool.query(SQL_GUARDAR_EVENTO, [
      eventoId, 'discord_event', 'info', 'discord', JSON.stringify(payload),
    ])).rows.length > 0;
  } catch (e) {
    return { ok: false, error: { message: txt(String((e as Error).message), 120) } };
  }

  // Compras e instalación de la app → DM directo al dueño (si hay token)
  let dm: string | null = null;
  const token = String(dep.env.DISCORD_BOT_TOKEN ?? '');
  if (TIPOS_DM.has(tipo) && token) {
    const dmId = String(dep.env.SUPERVISOR_DM_ID || DM_POR_DEFECTO);
    const canal = await abrirDM(dep.fetch, token, dmId);
    if (canal.ok && canal.id) {
      const r = await dapi(dep.fetch, token, 'POST', `/channels/${canal.id}/messages`, {
        embeds: [{
          title: `Discord · ${tipo}`,
          description: '```json\n' + txt(JSON.stringify(data), 600) + '\n```',
          color: 0x57f287,
        }],
        allowed_mentions: { parse: [] },
      });
      dm = r.ok ? 'enviado' : `fallo:${r.status}`;
    } else {
      dm = `dm:${canal.status}`;
    }
  }
  return { ok: true, guardado, evento_id: eventoId, ...(dm ? { dm } : {}) };
}

// ── Ciclo del puente (reemplazo serverless de agent_bridge.py) ─────────────
async function cicloTarea(dep: Dependencias): Promise<Record<string, unknown>> {
  const token = String(dep.env.DISCORD_BOT_TOKEN ?? '');
  const dmId = String(dep.env.SUPERVISOR_DM_ID || DM_POR_DEFECTO);
  const out: { incidentes: number; respuestas: number; errores: string[] } = { incidentes: 0, respuestas: 0, errores: [] };
  if (!token) {
    out.errores.push('falta DISCORD_BOT_TOKEN (deploy con --env o secret del repo)');
    return out;
  }
  const dm = await abrirDM(dep.fetch, token, dmId);
  if (!dm.ok || !dm.id) {
    out.errores.push(`dm:${dm.status}`);
    return out;
  }

  const pendientes = (await dep.pool.query(SQL_PEND_INCIDENTES, [])).rows;
  for (const row of pendientes) {
    const r = await dapi(dep.fetch, token, 'POST', `/channels/${dm.id}/messages`, {
      embeds: [embedIncidenteDM(row)],
      allowed_mentions: { parse: [] },
    });
    if (r.ok) out.incidentes += 1;
    // 403 = el dueño no acepta DMs: se marca igual para no reintentar eternamente
    if (r.ok || r.status === 403) {
      await dep.pool.query('UPDATE agent_events SET notificado = true, updated_at = now() WHERE id = $1', [row.id]);
    } else {
      out.errores.push(`inc#${row.id}:${r.status}`);
    }
    await dormir(350); // holgura anti rate-limit (patrón supervisor.py)
  }

  const respuestas = (await dep.pool.query(SQL_PEND_RESPUESTAS, [])).rows;
  for (const row of respuestas) {
    const texto = `Orden: ${txt(row.texto, 150)}\n\n${txt(row.respuesta, 1500)}`;
    const r = await dapi(dep.fetch, token, 'POST', `/channels/${dm.id}/messages`, {
      embeds: [
        {
          title: 'Agente VANTS · respuesta',
          description: texto.slice(0, 4000),
          color: row.estado === 'hecho' ? 0x3ddc84 : 0xed4245,
        },
      ],
      allowed_mentions: { parse: [] },
    });
    if (r.ok) out.respuestas += 1;
    if (r.ok || r.status === 403) {
      await dep.pool.query('UPDATE agent_comandos SET entregado = true WHERE id = $1', [row.id]);
    } else {
      out.errores.push(`cmd#${row.id}:${r.status}`);
    }
    await dormir(350);
  }
  return out;
}

// ── /setup: registro idempotente del comando global ────────────────────────
async function setupComandos(dep: Dependencias): Promise<Record<string, unknown>> {
  const token = String(dep.env.DISCORD_BOT_TOKEN ?? '');
  if (!token) return { ok: false, error: 'falta DISCORD_BOT_TOKEN' };
  const appId = appIdDeToken(token) || String(dep.env.DISCORD_APP_ID ?? '');
  if (!/^\d{17,20}$/.test(appId)) return { ok: false, error: 'no pude derivar DISCORD_APP_ID del token' };
  const lista = await dapi(dep.fetch, token, 'GET', `/applications/${appId}/commands`);
  if (!lista.ok) return { ok: false, error: `listando comandos: HTTP ${lista.status}` };
  const existente = (Array.isArray(lista.data) ? (lista.data as Fila[]) : []).find((c) => c.name === 'agente');
  const r = existente
    ? await dapi(dep.fetch, token, 'PATCH', `/applications/${appId}/commands/${existente.id}`, definicionComandoAgente())
    : await dapi(dep.fetch, token, 'POST', `/applications/${appId}/commands`, definicionComandoAgente());
  return { ok: r.ok, modo: existente ? 'patch' : 'create', status: r.status, comando: 'agente' };
}

// ── Salud ──────────────────────────────────────────────────────────────────
function salud(dep: Dependencias): Response {
  const token = String(dep.env.DISCORD_BOT_TOKEN ?? '');
  return json({
    ok: true,
    fn: 'vantsbot',
    config: {
      public_key: Boolean(dep.env.DISCORD_PUBLIC_KEY),
      bot_token: Boolean(token),
      app_id: token ? appIdDeToken(token) : dep.env.DISCORD_APP_ID || null,
      dm_id: String(dep.env.SUPERVISOR_DM_ID || DM_POR_DEFECTO),
      secret_tarea: Boolean((dep.env.VANTS_BOT_SECRET ?? '').length >= 32),
    },
    tablas: 'agent_runs, agent_events, agent_comandos (migración 25)',
  });
}

// ── Factory inyectable (convención de la casa, como matchmaking-service) ──
export function construir(sobre: Partial<Dependencias> = {}) {
  const env = sobre.env ?? process.env;
  const pool = sobre.pool ?? new Pool({ connectionString: env.DATABASE_URL, max: 3, idleTimeoutMillis: 30_000 });
  const f: typeof fetch = sobre.fetch ?? fetch;
  const saltarFirma = sobre.saltarFirma ?? false;
  const dep: Dependencias = { env, pool, fetch: f, saltarFirma };

  return async function handler(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let ruta = '/';
    try {
      ruta = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    } catch {
      /* ruta por defecto */
    }

    if (req.method === 'GET' && (ruta === '/' || ruta === '/salud')) return salud(dep);

    const secret = dep.env.VANTS_BOT_SECRET;
    if (ruta === '/tarea' || ruta === '/setup' || ruta === '/evento-discord') {
      if (req.method !== 'POST') return json({ ok: false, error: { message: 'usa POST' } }, 405);
      if (!autorizado(req.headers.get('x-vants-bot'), secret)) {
        return json({ ok: false, error: { message: 'unauthorized' } }, 401);
      }
      if (ruta === '/tarea') return json({ ok: true, resultado: await cicloTarea(dep) });
      if (ruta === '/evento-discord') {
        const body = (await req.json().catch(() => null)) as Fila | null;
        if (!body || typeof body !== 'object') return json({ ok: false, error: { message: 'bad_request' } }, 400);
        return json(await guardarEventoDiscord(dep, body));
      }
      return json(await setupComandos(dep));
    }

    if (req.method !== 'POST') return json({ ok: false, error: { message: 'no_encontrado' } }, 404);

    // ── Interactions endpoint de Discord ──
    const raw = await req.text();
    if (!saltarFirma) {
      const pk = String(env.DISCORD_PUBLIC_KEY ?? '');
      const firma = req.headers.get('x-signature-ed25519') ?? '';
      const ts = req.headers.get('x-signature-timestamp') ?? '';
      if (!pk) return json({ ok: false, error: { message: 'falta DISCORD_PUBLIC_KEY (secret del repo → --env en el deploy)' } }, 503);
      if (!verificarFirma(pk, ts, raw, firma)) return json({ ok: false, error: { message: 'invalid signature' } }, 401);
    }

    let body: Fila;
    try {
      body = JSON.parse(raw) as Fila;
    } catch {
      return json({ ok: false, error: { message: 'bad_request' } }, 400);
    }

    const tipo = Number(body.type ?? 0);
    if (tipo === 1) return json({ type: 1 }); // PING del portal

    if (tipo === 2) {
      const nombre = String((body.data as Fila | undefined)?.name ?? '');
      const tokenInteraccion = String(body.token ?? '');
      const appId = appIdDeToken(String(env.DISCORD_BOT_TOKEN ?? ''));

      if (nombre !== 'agente') {
        // Los demás comandos (perfil, ranking, torneos...) siguen siendo del
        // bot VANTCALL (gateway) cuando el dueño lo tiene encendido.
        return json({
          type: 4,
          data: {
            flags: 64,
            content: 'Este comando lo atiende el bot VANTCALL cuando está encendido. El mando del agente es `/agente`.',
          },
        });
      }

      // Allowlist de usuarios de Discord: si AGENT_DISCORD_IDS está definido
      // (ids separados por comas), SOLO esos usuarios pueden usar /agente y
      // el resto recibe 403. Sin la variable, comportamiento de siempre.
      const idsAgente = String(dep.env.AGENT_DISCORD_IDS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (idsAgente.length) {
        const miembro = (body.member as Fila | undefined)?.user as Fila | undefined;
        const quien = String(miembro?.id ?? (body.user as Fila | undefined)?.id ?? '');
        if (!quien || !idsAgente.includes(quien)) {
          return json({ ok: false, error: { message: 'no permitido' } }, 403);
        }
      }

      // Respuesta en < 3s garantizada: si el trabajo termina a tiempo se
      // contesta directo (type 4); si no, defer (type 5) + followup REST.
      const trabajo = procesarAgente(body, dep);
      let resultado: Salida | null = null;
      try {
        resultado = await Promise.race([trabajo, dormir(PRESUPUESTO_MS).then(() => null)]);
      } catch (e) {
        return json({ type: 4, data: { flags: 64, content: `Error del agente: ${txt(e, 180)}` } });
      }
      if (resultado) {
        return json({
          type: 4,
          data: {
            flags: 64,
            ...(resultado.embeds ? { embeds: resultado.embeds } : {}),
            ...(resultado.content ? { content: resultado.content } : {}),
          },
        });
      }
      // Frío (Neon arrancando): defer y sigue en background
      trabajo
        .then((res) =>
          appId && tokenInteraccion
            ? dapi(f, null, 'POST', `/webhooks/${appId}/${tokenInteraccion}`, {
                flags: 64,
                ...(res.embeds ? { embeds: res.embeds } : {}),
                ...(res.content ? { content: res.content } : {}),
              })
            : undefined
        )
        .catch((e) => console.error('[vantsbot] followup falló:', String(e)));
      return json({ type: 5, data: { flags: 64 } });
    }

    return json({ ok: false, error: { message: 'tipo de interaction no soportado' } }, 400);
  };
}

export default construir();
