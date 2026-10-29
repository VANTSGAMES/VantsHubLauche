#!/usr/bin/env node
'use strict';
// ============================================================
// MONITOR VANTS — control de la web + backend, alertas a Discord
//   node monitor/monitor.js            → chequeo; alerta solo si cambia el estado
//   node monitor/monitor.js --report   → además envía informe (estado + mejoras)
// Config: monitor/config.json  (webhookUrl vacío = avisos solo locales)
// ============================================================
const fs = require('fs');
const path = require('path');
const tls = require('tls');

const DIR = __dirname;
let cfg = {
  site: 'https://vants.vants.workers.dev/',
  // Proyecto Neon eliminado (migración a Supabase + worker vants-functions).
  // El worker vants-functions aún no está desplegado: el check proxy se
  // reactiva cuando exista. Antes: ...-vantsdata.compute...neon.tech/ (403).
  proxy: 'https://vants-functions.vants.workers.dev/fn/vantsdata/',
  webhookUrl: '',
  slowMs: 4000,
  certWarnDays: 14,
  timeoutMs: 15000,
};
try { cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'))); } catch {}
if (process.env.VANTS_DISCORD_WEBHOOK) cfg.webhookUrl = process.env.VANTS_DISCORD_WEBHOOK;

const REPORT = process.argv.includes('--report');
const COLORS = { up: 0x3ddc84, degraded: 0xffb547, down: 0xff4655, info: 0x5865f2 };

// Corregido 2026-10-29 (issue #121): fuera las rutas de la era GitHub Pages
// (assets/css/arena.css, assets/js/arena.js, arena-live.js, auth0-config.js —
// nunca existieron en el Worker -> 404 falsos y DOWN permanente). Dentro:
// paginas reales del Worker + salud del bot Discord y del VANTS-BUS.
const CRIT = [
  { id: 'web', label: 'Web (Cloudflare Worker)', url: cfg.site, markers: ['VANTS GAMES'] },
  { id: 'health', label: 'API health', url: cfg.site + 'api/health', markers: ['"ok":true'] },
  { id: 'ranking', label: 'Ranking', url: cfg.site + 'ranking.html' },
  { id: 'perfil', label: 'Perfil', url: cfg.site + 'perfil.html' },
  { id: 'clips', label: 'Clips', url: cfg.site + 'clips.html' },
  { id: 'bot', label: 'Bot Discord (salud)', url: 'https://vantsbot.vants.workers.dev/salud', markers: ['"ok":true'] },
  { id: 'bus', label: 'VANTS-BUS (salud)', url: 'https://vants-bus.vants.workers.dev/health', markers: ['"ok":true'] },
  // { id: 'proxy', label: 'vantsdata (API de lectura)', url: cfg.proxy, markers: ['"ok":true'] },  // pendiente: desplegar worker vants-functions
];
const EXTERN = [
  { id: 'auth0', label: 'Auth0 CDN', url: 'https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js' },
  { id: 'fonts', label: 'Google Fonts', url: 'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap' },
  { id: 'lucide', label: 'unpkg (lucide)', url: 'https://unpkg.com/lucide@0.454.0/dist/umd/lucide.min.js' },
];

async function httpCheck(c) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
    const r = await fetch(c.url, { signal: ctrl.signal, headers: { 'accept': '*/*', 'user-agent': 'Mozilla/5.0 (compatible; VANTS-Monitor/1.0)' } });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const headers = {};
    for (const k of ['content-encoding', 'cache-control', 'content-type']) headers[k] = r.headers.get(k);
    let size = null, ok = r.ok, err = null;
    if (c.markers) {
      const txt = await r.text();
      size = Buffer.byteLength(txt);
      for (const m of c.markers) if (!txt.includes(m)) { ok = false; err = `falta marcador "${m}"`; }
    } else {
      const buf = await r.arrayBuffer();
      size = buf.byteLength;
    }
    if (!r.ok && ok) ok = false, err = 'HTTP ' + r.status; // marcador ok pero status raro
    return { ok, status: r.status, ms, size, headers, err };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, size: null, headers: {}, err: e.name === 'AbortError' ? 'timeout' : e.message.slice(0, 80) };
  }
}

function certDays(host) {
  return new Promise((res) => {
    try {
      const s = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
        const c = s.getPeerCertificate();
        s.destroy();
        res(c && c.valid_to ? Math.floor((new Date(c.valid_to) - Date.now()) / 86400000) : null);
      });
      s.on('error', () => res(null));
      s.on('timeout', () => { s.destroy(); res(null); });
    } catch { res(null); }
  });
}

async function discord(title, description, color, fields) {
  if (!cfg.webhookUrl) { console.log('[discord] webhook no configurado — aviso solo local'); return; }
  const embed = { title, description, color, fields, footer: { text: 'VANTS · monitor' }, timestamp: new Date().toISOString() };
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(cfg.webhookUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'VANTS Monitor', embeds: [embed], allowed_mentions: { parse: [] } }),
      });
      if (r.ok) return;
      if (r.status === 429) {
        const j = await r.json().catch(() => ({}));
        await new Promise((ok) => setTimeout(ok, ((j.retry_after || 1) * 1000) + 250));
        continue;
      }
      console.log(`[discord] error ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
      return;
    } catch (e) { console.log('[discord] ' + e.message); return; }
  }
}

function mejoras(crit, extern, certs) {
  const out = [];
  const web = crit.find((c) => c.id === 'web');
  if (web) {
    if (!web.headers['content-encoding']) out.push('La web no llega comprimida (gzip/brotli) — revisar cabeceras del Worker.');
    const assets = crit.filter((c) => c.id !== 'web' && c.id !== 'proxy');
    const noCache = assets.filter((c) => !(c.headers['cache-control'] || '').includes('max-age'));
    if (noCache.length) out.push(`${noCache.length} assets sin caché (cache-control): ${noCache.map((c) => c.label).join(', ')}.`);
    const total = assets.reduce((s, c) => s + (c.size || 0), 0);
    out.push(`Peso descargado (JS+CSS, sin comprimir): ~${Math.round(total / 1024)} KB — minificar/partir el JS si crece.`);
    const externos = extern.map((c) => c.label).join(' · ');
    out.push(`Dependencias de terceros en el HTML: ${externos}. Self-host de lucide (assets/vendor) quita el riesgo de que unpkg caiga.`);
    out.push('Añadir <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin> antes del CSS de Google Fonts (los ficheros vienen de gstatic, no de googleapis).');
  }
  for (const [host, d] of Object.entries(certs)) if (d != null && d < 30) out.push(`Certificado de ${host} caduca en ${d} días.`);
  return out.slice(0, 8);
}

(async () => {
  const crit = [], extern = [];
  for (const c of CRIT) crit.push(Object.assign({}, c, await httpCheck(c)));
  for (const c of EXTERN) extern.push(Object.assign({}, c, await httpCheck(c)));

  const hosts = [...new Set([new URL(cfg.site).hostname, new URL(cfg.proxy).hostname])];
  const certs = {};
  for (const h of hosts) certs[h] = await certDays(h);

  const failed = crit.filter((c) => !c.ok);
  const slow = crit.filter((c) => c.ok && c.ms > cfg.slowMs);
  const certBad = Object.entries(certs).filter(([, d]) => d != null && d < cfg.certWarnDays);
  const externFail = extern.filter((c) => !c.ok);
  const status = failed.length ? 'DOWN' : (slow.length || certBad.length || externFail.length) ? 'DEGRADED' : 'UP';
  const okCount = crit.filter((c) => c.ok).length + extern.filter((c) => c.ok).length;

  for (const c of [...crit, ...extern]) {
    const flag = c.ok ? (c.ms > cfg.slowMs ? 'LENTO' : 'OK   ') : 'FALLO';
    console.log(`${flag}  ${c.label.padEnd(24)} ${String(c.status).padEnd(4)} ${String(c.ms).padStart(5)}ms ${c.size != null ? String(Math.round(c.size / 1024)).padStart(4) + 'KB' : '    '} ${c.err ? '· ' + c.err : ''}`);
  }
  for (const [h, d] of Object.entries(certs)) console.log(`SSL  ${h.padEnd(24)} caduca en ${d == null ? '?' : d + ' días'}`);

  // --- estado persistente: alertar solo en transiciones
  let st = { status: 'UNKNOWN', since: Date.now() };
  try { st = JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8')); } catch {}
  const changed = st.status !== status;
  const web = crit[0];

  if (changed && status === 'DOWN') {
    console.log(`[ALERT] DOWN — falla: ${failed.map((c) => c.label + ' (' + (c.err || c.status) + ')').join('; ')}`);
    await discord('🔴 VANTS caído', `Estado anterior: ${st.status}. Fallo detectado en ${failed.length} comprobación(es).`, COLORS.down,
      failed.map((c) => ({ name: c.label, value: `${c.err || 'HTTP ' + c.status}`, inline: true })));
  } else if (changed && status === 'DEGRADED' && st.status !== 'DOWN') {
    const causes = [].concat(slow.map((c) => `${c.label} lenta (${c.ms}ms)`), certBad.map(([h, d]) => `cert ${h} ${d}d`), externFail.map((c) => `${c.label} caída`));
    console.log(`[ALERT] DEGRADADO — ${causes.join('; ')}`);
    await discord('🟡 VANTS degradado', causes.join(' · '), COLORS.degraded,
      [{ name: 'Web', value: `${web.ms}ms · ${Math.round((web.size || 0) / 1024)}KB`, inline: true }]);
  } else if (changed && status === 'UP' && (st.status === 'DOWN' || st.status === 'DEGRADED')) {
    const mins = Math.round((Date.now() - (st.since || Date.now())) / 60000);
    console.log(`[ALERT] RECUPERADA tras ~${mins} min`);
    await discord('🟢 VANTS recuperado', `Volvía de estado ${st.status} (incidente de ~${mins} min). Todo operativo.`, COLORS.up, []);
  }

  if (REPORT) {
    const mej = mejoras(crit, extern, certs);
    await discord('📊 VANTS — informe de estado', `Estado global: **${status}** · ${okCount}/${crit.length + extern.length} comprobaciones OK`, COLORS.info, [
      { name: 'Web', value: `${web.status} · ${web.ms}ms · ${Math.round((web.size || 0) / 1024)}KB · ${web.headers['content-encoding'] || 'sin comprimir'}`, inline: true },
      { name: 'API lectura', value: `${(crit.find((c) => c.id === 'proxy') || {}).ms || '—'}${crit.find((c) => c.id === 'proxy') ? 'ms' : ' (pendiente deploy)'}`, inline: true },
      { name: 'SSL', value: hosts.map((h) => `${h}: ${certs[h] == null ? '?' : certs[h] + 'd'}`).join('\n'), inline: false },
      { name: 'Mejoras propuestas', value: mej.map((m, i) => `${i + 1}. ${m}`).join('\n').slice(0, 1000) || '—' },
    ]);
    console.log('\nMEJORAS PROPUESTAS:');
    mej.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
  }

  console.log(`\nESTADO: ${status} (${okCount}/${crit.length + extern.length} OK)`);
  fs.writeFileSync(path.join(DIR, 'state.json'), JSON.stringify({ status, since: changed ? Date.now() : (st.since || Date.now()), lastRun: new Date().toISOString() }, null, 2));
  if (failed.length) process.exitCode = 1;
})();
