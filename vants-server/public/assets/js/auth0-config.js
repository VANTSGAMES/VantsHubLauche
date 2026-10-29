// ============================================
// VANTCALL — Configuración Auth0 + Neon Data API
// Reemplaza al antiguo db.js (Supabase).
// Incluye compatibilidad con window.VantDB.client para app.js
// ============================================

// --- Auth0 ---
const AUTH0_DOMAIN = 'vants.eu.auth0.com';
const AUTH0_CLIENT_ID = 'oaOmNizh7HrASWfmfM29bN284IMJvqPG'; // VANTS movil
const AUTH0_AUDIENCE = 'https://api.vants.app';

// --- Neon Data API ---
const NEON_DATA_API = 'https://ep-autumn-scene-b4opu2ip.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';

// --- Proxy público (Neon Function "vantsdata") para lecturas sin sesión ---
// Neon Data API exige siempre un JWT; sin sesión las lecturas pasan por esta función.
const PUBLIC_PROXY = 'https://br-sweet-shape-b42xhogj-vantsdata.compute.c-6.us-east-2.aws.neon.tech/';

// --- Linker (conectores OAuth de cuentas: Twitch/Kick/YouTube/TikTok/X/Riot/Steam/FACEIT) ---
// URL pública de la Neon Function "linker" (desplegada por el workflow
// "Neon · deploy de funciones"). Con FACEIT_CLIENT_ID cargado, FACEIT conecta
// por OAuth real; las redes sin claves siguen ofreciendo vínculo MANUAL.
const LINKER_BASE = 'https://br-sweet-shape-b42xhogj-linker.compute.c-6.us-east-2.aws.neon.tech';

// --- Checkout Stripe (pagos REALES: planes, pase premium y fees de torneo) ---
// URL pública de la Neon Function "stripe-checkout" (Neon → Functions → stripecheckout).
// Mientras esté vacía, la web conserva el modo demostración (pagos simulados, sin cobro).
const CHECKOUT_BASE = 'https://br-sweet-shape-b42xhogj-stripecheckout.compute.c-6.us-east-2.aws.neon.tech';

let auth0Client = null;
let currentToken = null;

async function initAuth0() {
  auth0Client = await auth0.createAuth0Client({
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin + window.location.pathname.replace(/[^/]*$/, ''),
      audience: AUTH0_AUDIENCE,
      scope: 'openid profile email',
    },
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
  });
  return auth0Client;
}

async function getToken() {
  if (!auth0Client) return null;
  try {
    currentToken = await auth0Client.getTokenSilently();
    return currentToken;
  } catch {
    return null;
  }
}

// --- Cliente PostgREST hacia Neon Data API ---
function from(table) {
  return new PostgrestQueryBuilder(table);
}

class PostgrestQueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orderCol = null;
    this.orderAsc = true;
    this.limitN = null;
    this.selectCols = '*';
    this.countMode = null;
    this.headOnly = false;
    this.singleResult = false;
    this.maybeSingleResult = false;
    this.insertData = null;
    this.updateData = null;
    this.deleteMode = false;
    this.method = 'GET';
  }

  select(cols = '*', opts = {}) {
    this.selectCols = cols;
    if (opts.count) this.countMode = opts.count;
    if (opts.head) this.headOnly = true;
    return this;
  }
  insert(data) { this.insertData = data; this.method = 'POST'; return this; }
  upsert(data, opts = {}) { this.insertData = data; this.method = 'POST'; this.upsertMode = true; this.onConflict = opts.onConflict || null; return this; }
  update(data) { this.updateData = data; this.method = 'PATCH'; return this; }
  delete() { this.deleteMode = true; this.method = 'DELETE'; return this; }
  eq(col, val) { this.filters.push([col, 'eq', val]); return this; }
  neq(col, val) { this.filters.push([col, 'neq', val]); return this; }
  gt(col, val) { this.filters.push([col, 'gt', val]); return this; }
  lt(col, val) { this.filters.push([col, 'lt', val]); return this; }
  gte(col, val) { this.filters.push([col, 'gte', val]); return this; }
  lte(col, val) { this.filters.push([col, 'lte', val]); return this; }
  ilike(col, val) { this.filters.push([col, 'ilike', val]); return this; }
  like(col, val) { this.filters.push([col, 'like', val]); return this; }
  is(col, val) { this.filters.push([col, 'is', val]); return this; }
  in(col, vals) { this.filters.push([col, 'in', vals]); return this; }
  not(col, op, val) { this.filters.push([col, 'not.' + op, val]); return this; }
  or(expr) { expr = String(expr).trim(); if (expr[0] !== '(') expr = '(' + expr + ')'; this.filters.push(['or', null, expr]); return this; }
  order(col, opts = {}) { this.orderCol = col; this.orderAsc = opts.ascending !== false; return this; }
  limit(n) { this.limitN = n; return this; }
  single() { this.singleResult = true; return this; }
  maybeSingle() { this.maybeSingleResult = true; return this; }

  async then(resolve, reject) {
    try {
      const result = await this.execute();
      resolve(result);
    } catch (e) {
      if (reject) reject(e);
      else resolve({ data: null, error: e });
    }
  }

  async execute() {
    const token = await getToken();
    const url = new URL(NEON_DATA_API + '/' + this.table);
    if (this.selectCols !== '*') url.searchParams.set('select', this.selectCols);
    for (const [col, op, val] of this.filters) {
      if (col === 'or') url.searchParams.set('or', val);
      else url.searchParams.set(col, op + '.' + (Array.isArray(val) ? '(' + val.join(',') + ')' : val));
    }
    if (this.orderCol) url.searchParams.set('order', this.orderCol + '.' + (this.orderAsc ? 'asc' : 'desc'));
    if (this.limitN) url.searchParams.set('limit', String(this.limitN));

    // Sin sesión + lectura → pasar por el proxy público (sin cabeceras, evita preflight CORS)
    if (!token && this.method === 'GET') {
      const proxyUrl = new URL(PUBLIC_PROXY);
      proxyUrl.searchParams.set('table', this.table);
      url.searchParams.forEach((v, k) => proxyUrl.searchParams.set(k, v));
      if (this.countMode) proxyUrl.searchParams.set('_count', this.countMode);
      if (this.headOnly) proxyUrl.searchParams.set('limit', '1');
      const pres = await fetch(proxyUrl.toString());
      const pbody = await pres.json().catch(() => null);
      if (!pres.ok) {
        return { data: null, error: { message: (pbody && pbody.message) || pres.statusText, status: pres.status } };
      }
      if (this.headOnly) {
        const cr = pres.headers.get('content-range');
        return { count: cr ? parseInt(cr.split('/')[1]) || 0 : 0, error: null, data: null };
      }
      let pdata = pbody;
      if ((this.singleResult || this.maybeSingleResult) && Array.isArray(pdata)) pdata = pdata[0] || null;
      if (this.singleResult && !pdata) return { data: null, error: { message: 'No encontrado', status: 406 } };
      return { data: pdata, error: null };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (this.countMode) headers['Prefer'] = 'count=' + this.countMode;
    if (this.singleResult || this.maybeSingleResult) headers['Accept'] = 'application/vnd.pgrst.object+json';

    const opts = { method: this.method, headers };
    if (this.insertData) opts.body = JSON.stringify(this.insertData);
    if (this.upsertMode) { headers['Prefer'] = 'resolution=merge-duplicates'; if (this.onConflict) url.searchParams.set('on_conflict', this.onConflict); }
    if (this.updateData) opts.body = JSON.stringify(this.updateData);

    const res = await fetch(url.toString(), opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      return { data: null, error: { message: err.message || res.statusText, status: res.status } };
    }

    if (this.headOnly) {
      const count = res.headers.get('content-range');
      return { count: count ? parseInt(count.split('/')[1]) : 0, error: null, data: null };
    }

    if (res.status === 204) return { data: null, error: null };

    const raw = await res.text();
    if (!raw) return { data: null, error: null };
    let data = JSON.parse(raw);
    if (this.maybeSingleResult && Array.isArray(data)) data = data[0] || null;
    return { data, error: null };
  }
}

// --- RPC ---
async function rpc(fnName, params = {}) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(NEON_DATA_API + '/rpc/' + fnName, {
    method: 'POST', headers, body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    return { data: null, error: { message: err.message || res.statusText } };
  }
  const data = await res.json();
  return { data, error: null };
}

// Caché corta en memoria
const cache = new Map();
const TTL = 30 * 1000;
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}
function invalidate(prefix) {
  for (const k of cache.keys()) if (!prefix || k.startsWith(prefix)) cache.delete(k);
}

async function q(builder) {
  const { data, error } = await builder;
  if (error) throw error;
  return data;
}

const DB = {
  from,
  rpc,
  invalidate,
  getToken,
  // Compatibilidad con app.js que usa window.VantDB.client
  client: {
    from,
    rpc,
    // Las Edge Functions de Supabase ya no existen: el bot se gestionará desde Neon/n8n.
    functions: { invoke: async () => ({ data: null, error: { message: 'Función no disponible todavía (migración desde Supabase).' } }) },
  },

  stats: () => cached('stats', async () => {
    const count = async (t, f) => {
      let b = from(t).select('id', { count: 'exact', head: true });
      if (f) b = f(b);
      const { count: c, error } = await b;
      if (error) throw error;
      return c || 0;
    };
    const [players, tournaments, events, matches] = await Promise.all([
      count('players'),
      count('tournaments'),
      count('events', (b) => b.gte('starts_at', new Date().toISOString())),
      count('ranked_matches', (b) => b.eq('status', 'completed')),
    ]);
    return { players, tournaments, events, matches };
  }),

  activeSeason: () => cached('season', async () => {
    const rows = await q(from('seasons').select('*').order('season_number', { ascending: false }).limit(5));
    return rows.find((s) => s.status === 'active') || rows[0] || null;
  }),

  rules: () => cached('rules', () => q(from('ranked_rules').select('rule_key, rule_value, description').order('rule_key'))),

  leaderboard: (seasonId, limit = 50) => cached('lb:' + seasonId + ':' + limit, () => {
    if (!seasonId) return [];
    return q(from('leaderboard').select('*').eq('season_id', seasonId).order('mmr', { ascending: false }).limit(limit));
  }),

  tournaments: () => cached('tournaments', () => q(from('tournaments').select('*').order('starts_at', { ascending: true, nullsFirst: false }))),

  tournament: (slug) => cached('t:' + slug, async () => {
    const t = await q(from('tournaments').select('*').eq('slug', slug).maybeSingle());
    if (!t) return null;
    const [entries, matches] = await Promise.all([
      q(from('tournament_entries').select('id, status, seed, registered_at, player:players(id, username, display_name, avatar_url, region)').eq('tournament_id', t.id).order('seed', { ascending: true, nullsFirst: false })),
      q(from('tournament_matches').select('*, p1:players!tournament_matches_player1_id_fkey(username, display_name), p2:players!tournament_matches_player2_id_fkey(username, display_name)').eq('tournament_id', t.id).order('round').order('match_number')),
    ]);
    return { ...t, entries, matches };
  }),

  events: () => cached('events', () => q(from('events').select('*').order('starts_at', { ascending: true }))),

  scheduledMatches: () => cached('tmatches', () => q(
    from('tournament_matches')
      .select('id, round, match_number, status, scheduled_at, player1_score, player2_score, winner_id, player1_id, player2_id, tournament:tournaments(name, slug), p1:players!tournament_matches_player1_id_fkey(username, display_name), p2:players!tournament_matches_player2_id_fkey(username, display_name)')
      .not('scheduled_at', 'is', null)
      .order('scheduled_at', { ascending: true })
      .limit(200)
  )),

  players: (search) => cached('players:' + (search || ''), () => {
    let b = from('players').select('id, username, display_name, avatar_url, region, main_game, verified, created_at').order('created_at', { ascending: false }).limit(100);
    if (search) b = b.or(`username.ilike.%${search.replace(/[%,()]/g, '')}%,display_name.ilike.%${search.replace(/[%,()]/g, '')}%`);
    return q(b);
  }),

  player: (username) => cached('p:' + username, async () => {
    const p = await q(from('players').select('id, username, display_name, avatar_url, region, summoner_name, verified, created_at, main_game, country').eq('username', username).maybeSingle());
    if (!p) return null;
    const [profile, stats, matches, entries] = await Promise.all([
      q(from('profiles').select('bio, visibility, stats').eq('player_id', p.id).maybeSingle()),
      q(from('season_player_stats').select('mmr, rank, wins, losses, placement_done, season:seasons(name, season_number, status)').eq('player_id', p.id)),
      q(from('ranked_matches').select('id, result, status, mmr_change_p1, mmr_change_p2, player1_id, player2_id, completed_at, created_at').or(`player1_id.eq.${p.id},player2_id.eq.${p.id}`).order('created_at', { ascending: false }).limit(20)),
      q(from('tournament_entries').select('status, registered_at, tournament:tournaments(name, slug, status, starts_at)').eq('player_id', p.id)),
    ]);
    return { ...p, profile, stats, matches, entries };
  }),
};

window.VantDB = DB;
window.VantAuth0 = { initAuth0, getToken, LINKER_BASE, CHECKOUT_BASE, get client() { return auth0Client; } };
// Interruptor de pagos reales para arena.js: con base configurada, los botones
// PAGAR/SUSCRIBIRME abren el Checkout de Stripe; vacía, quedan en modo demostración.
window.VantPay = { base: CHECKOUT_BASE };

// El pie de página debe reflejar siempre el modo de pagos real. Si CHECKOUT_BASE
// no está configurada, restaura el aviso de demostración (se ejecuta siempre,
// con o sin sesión, y en cualquier página que tenga el footer).
(function () {
  try {
    var real = !!(window.VantPay && window.VantPay.base);
    var spans = document.querySelectorAll('.f-bottom span');
    for (var i = 0; i < spans.length; i++) {
      var s = spans[i];
      if (real && s.textContent.indexOf('pagos son simulados') !== -1) {
        s.textContent = 'Pagos seguros procesados por Stripe · Tarjeta, Klarna, Link y más.';
      } else if (!real && s.textContent.indexOf('Stripe') !== -1) {
        s.textContent = 'Demo de producto: los pagos son simulados, no se realiza ningún cobro real.';
      }
    }
  } catch (e) {}
})();
