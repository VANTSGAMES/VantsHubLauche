// ============================================================
// FACEIT XP — sondeo de la Data API (respaldo del webhook)
// Lee los jugadores con FACEIT vinculado (vants_links), consulta su
// historial de CS2 en la Data API v4 y registra cada partida vía
// faceit_aplicar_resultado() — idempotente (UNIQUE faceit_match_id),
// misma puerta que el webhook: XP + rating + stats de temporada.
//
// Variables: DATABASE_URL (cadena psql), FACEIT_API_KEY, FACEIT_DISCORD_WEBHOOK (opcional)
// Uso: node scripts/faceit-xp.mjs
// ============================================================
import { execFileSync } from 'node:child_process';

const CS = process.env.DATABASE_URL || '';
const KEY = process.env.FACEIT_API_KEY || '';
const WEBHOOK = process.env.FACEIT_DISCORD_WEBHOOK || '';
if (!CS || !KEY) { console.error('Faltan DATABASE_URL o FACEIT_API_KEY'); process.exit(1); }

const psql = (sql) => execFileSync('psql', [CS, '-t', '-A', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-c', sql],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

const api = async (path) => {
  // Host oficial de la Data API (docs FACEIT): open.faceit.com.
  // api.faceit.com/data/v4 responde HTTP 500 con API keys server-side (verificado
  // 2026-10-19 con la key del dueño), open.faceit.com responde 200.
  const r = await fetch('https://open.faceit.com' + path, {
    headers: { Authorization: 'Bearer ' + KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`FACEIT ${path} → ${r.status}`);
  return r.json();
};
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// 1) Jugadores con FACEIT vinculado (manual u OAuth) y su player_id real
const lin = psql(`
  SELECT vl.platform_user_id AS guid,
         COALESCE(vl.player_id::text, p.id::text) AS pid,
         COALESCE(p.username, 'jugador') AS username
  FROM vants_links vl
  LEFT JOIN players p ON p.auth0_sub = vl.auth0_sub
  WHERE vl.platform = 'faceit'
    AND vl.platform_user_id IS NOT NULL
    AND (vl.player_id IS NOT NULL OR p.id IS NOT NULL)`).trim();
const jugadores = lin ? lin.split('\n').map((l) => { const [guid, pid, ...rest] = l.split('\t'); return { guid, pid, username: rest.join('\t') }; }) : [];
console.log(`jugadores FACEIT vinculados: ${jugadores.length}`);
if (!jugadores.length) process.exit(0);

// 2) Partidas ya procesadas
const ya = new Set(psql(`SELECT faceit_match_id FROM faceit_matches`).trim().split('\n').filter(Boolean));

// 3) Historial por jugador (CS2, últimas 20) → partidas nuevas finalizadas
const victorias = [];
for (const j of jugadores) {
  try {
    const hist = await api(`/data/v4/players/${j.guid}/history?game=cs2&limit=20`).catch(() => null);
    const items = (hist && hist.items) || [];
    for (const it of items) {
      const mid = it.match_id;
      if (!mid || ya.has(mid)) continue;
      await sleep(250);
      const m = await api(`/data/v4/matches/${mid}`).catch(() => null);
      if (!m) continue;
      const winner = m.results && m.results.winner; // 'faction1' | 'faction2'
      if (!winner) continue; // sin terminar
      const f1 = ((m.teams && m.teams.faction1 && m.teams.faction1.roster) || []).map((x) => String(x.player_id));
      const f2 = ((m.teams && m.teams.faction2 && m.teams.faction2.roster) || []).map((x) => String(x.player_id));
      const lado = f1.includes(String(j.guid)) ? 'faction1' : f2.includes(String(j.guid)) ? 'faction2' : null;
      if (!lado) continue;
      const result = winner === lado ? 'win' : 'loss';
      const ts = m.started_at || (it.started_at || null);
      const sqlTs = ts ? `to_timestamp(${Math.floor(new Date(ts).getTime() / 1000)})` : 'now()';
      try {
        const out = psql(`SELECT faceit_aplicar_resultado('${j.pid}', '${mid}', 'cs2', '${result}', ${sqlTs}, NULL);`);
        const line = out.trim().split('\n').pop();
        console.log(`${j.username} ${mid} ${result} → ${line}`);
        if (result === 'win' && line.includes('"nueva":true')) {
          let xpTotal = null, nivel = null;
          try { const d = JSON.parse(line); xpTotal = d.xp_total; nivel = d.nivel; } catch {}
          victorias.push({ username: j.username, xpTotal, nivel, mid });
        }
      } catch (e) { console.log(`SQL ${mid}: ${String(e.message).slice(0, 160)}`); }
    }
  } catch (e) { console.log(`historial ${j.username}: ${String(e.message).slice(0, 160)}`); }
  await sleep(250);
}

// 4) Alerta a Discord (embed por victoria) si hay webhook
if (victorias.length && WEBHOOK) {
  for (const v of victorias.slice(0, 10)) {
    try {
      await fetch(WEBHOOK, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: 'VANTS FACEIT',
          embeds: [{
            title: 'Victoria FACEIT · +100 XP',
            description: `**${v.username}** ganó una partida de CS2 en FACEIT.`,
            color: 0x3ddc84,
            fields: [
              { name: 'XP total', value: String(v.xpTotal ?? '—'), inline: true },
              { name: 'Nivel', value: String(v.nivel ?? '—'), inline: true },
              { name: 'Partida', value: `https://www.faceit.com/es/cs2/room/${v.mid}`, inline: false },
            ],
            footer: { text: 'VANTS · experiencia FACEIT' },
            timestamp: new Date().toISOString(),
          }],
          allowed_mentions: { parse: [] },
        }),
      });
      await sleep(400);
    } catch (e) { console.log('discord: ' + String(e.message).slice(0, 120)); }
  }
}
console.log(`victorias nuevas: ${victorias.length}`);
