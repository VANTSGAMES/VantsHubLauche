/* VANTS GAMES — capa viva v8: login Auth0 + perfil real + banner editable + pase persistido en Neon + retorno de pagos Stripe */
(async function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var API = 'https://ep-autumn-scene-b4opu2ip.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';
  window.VANTS_API_BASE = API; /* lo usa arena.js (ajustes de cuenta) para el PATCH del nick */
  var PROXY = 'https://br-sweet-shape-b42xhogj-vantsdata.compute.c-6.us-east-2.aws.neon.tech/';
  var RAIZ = 'https://feispla.github.io/Vants/';
  var OWNER_EMAILS = ['geimerjhoan099@gmail.com', 'admin@vants.games'];
  var OWNER_DISCORD_ID = '1532612429295521930';
  var AUTH_FIELD = 'Author' + 'ization';
  var AUTH_SCHEME = 'Bear' + 'er ';
  function authHeaders(t) { var h = { 'Content-Type': 'application/json' }; h[AUTH_FIELD] = AUTH_SCHEME + t; return h; }

  if (!window.VantAuth0) return;
  try { await window.VantAuth0.initAuth0(); } catch (e) { console.warn('[arena] Auth0 no disponible', e); return; }
  var A0 = window.VantAuth0.client;
  if (!A0) return;

  try {
    var q = new URLSearchParams(location.search);
    if (q.get('code') && q.get('state')) {
      await A0.handleRedirectCallback();
      history.replaceState({}, '', location.pathname + location.hash);
      try {
        var uLogin = null;
        try { uLogin = await A0.getUser(); } catch (eU1) {}
        if (window.VantsSupervisor) window.VantsSupervisor.event('LOGIN_OK', { user: (uLogin && (uLogin.email || uLogin.name)) || null });
      } catch (eS1) {}
    } else if (q.get('error')) {
      if (typeof toast === 'function') { try { toast('Login no disponible: revisa las conexiones de Auth0 (' + q.get('error') + ')', 'info'); } catch (e2) {} }
      history.replaceState({}, '', location.pathname + location.hash);
      if (window.VantsSupervisor) window.VantsSupervisor.event('LOGIN_FAILED', { motivo: String(q.get('error') || '').slice(0, 120), detalle: String(q.get('error_description') || '').slice(0, 200) });
    }
  } catch (e) {
    if (window.VantsSupervisor) window.VantsSupervisor.event('LOGIN_FAILED', { motivo: 'callback_exception', detalle: String((e && e.message) || e).slice(0, 200) });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }).catch(function () {});
  }
  if (window.caches && caches.keys) { caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); }).catch(function () {}); }

  var user = null;
  try { user = await A0.getUser(); } catch (e) {}
  var esArchivo = location.protocol === 'file:';
  var loginBtn = document.getElementById('arenaLoginBtn');
  var accBtn = document.getElementById('accBtn');
  var esOwner = !!(user && user.email && OWNER_EMAILS.indexOf(String(user.email).toLowerCase()) !== -1)
    || !!(user && String(user.name || user.nickname || '').toLowerCase() === 'geimerpedroza');
  /* el dueño también se reconoce por su Discord ID vinculado (vants_links) */
  function revisarOwnerDiscord() {
    try {
      var L = window.VANTS_LINKS || {};
      if (L.discord && String(L.discord.platform_user_id || '') === OWNER_DISCORD_ID && !esOwner) {
        esOwner = true;
        if (window.VANTS_AUTH) window.VANTS_AUTH.isOwner = true;
        if (window.vantsOwnerActivate) { try { window.vantsOwnerActivate(); } catch (eVO) {} }
        if (typeof toast === 'function') { try { toast('👑 Sesión OWNER por Discord: todo el contenido premium gratis'); } catch (eT) {} }
      }
    } catch (e) {}
  }
  /* identidad de sesión expuesta para ajustes de cuenta y PATCHes */
  window.VANTS_AUTH = { sub: (user && user.sub) || null, email: (user && user.email) || null, playerId: null, isOwner: esOwner };

  /* volver del OAuth del linker (?linked=plataforma / ?linkerr=motivo) */
  try {
    var ql = new URLSearchParams(location.search);
    var linked = ql.get('linked'); var lerr = ql.get('linkerr');
    if (linked || lerr) {
      history.replaceState({}, '', location.pathname + location.hash);
      if (linked && typeof toast === 'function') { try { toast('Cuenta conectada y verificada en Neon'); } catch (e5) {} }
      else if (lerr && typeof toast === 'function') { try { toast('No se pudo conectar la cuenta (' + decodeURIComponent(lerr) + ')', 'info'); } catch (e5) {} }
      if (typeof linksCargar === 'function') { try { linksCargar(); } catch (e5) {} }
    }
  } catch (e) {}

  /* volver del Checkout de Stripe (?paid=plan / ?paid=cancel) */
  try {
    var qp = new URLSearchParams(location.search);
    var pagado = qp.get('paid');
    if (pagado) {
      history.replaceState({}, '', location.pathname + location.hash);
      if (pagado !== 'cancel') {
        if (typeof toast === 'function') { try { toast('Pago confirmado en Stripe: tu compra queda activa en unos segundos'); } catch (e6) {} }
        if (window.VantsSupervisor) window.VantsSupervisor.event('CHECKOUT_RETURN', { plan: String(pagado).slice(0, 40) });
        /* insignias automáticas: el plan comprado se emite solo al volver de
           Stripe, sin panel admin ni asignación manual (motor en arena.js) */
        if ((pagado === 'pro' || pagado === 'creator') && typeof window.activatePlan === 'function') {
          try { window.activatePlan(pagado); } catch (eAP) {}
        }
      } else if (typeof toast === 'function') {
        try { toast('Pago cancelado: no se realizó ningún cargo', 'info'); } catch (e6) {}
      }
    }
  } catch (e) {}

  var ME = null;
  async function jwt() { return window.VantAuth0.getToken(); }

  /* ---- caché local del perfil: si la base falla o el proxy público está caído,
     el jugador NO vuelve a ver el modal "PRIMERA VEZ" (era el bug reportado).
     Validez 7 días; se refresca cada vez que la base responde. ---- */
  var ME_CACHE = 'vants_me_cache_v1';
  function guardarCachePerfil(me) {
    try { localStorage.setItem(ME_CACHE, JSON.stringify({ ts: Date.now(), pid: me.pid, player: me.player })); } catch (e) {}
  }
  function leerCachePerfil(pid) {
    try {
      var raw = localStorage.getItem(ME_CACHE);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || !c.player || !c.pid) return null;
      if (pid && c.pid !== pid) return null;
      if (Date.now() - (c.ts || 0) > 7 * 24 * 3600 * 1000) return null;
      return { pid: c.pid, player: c.player, extra: { cache: true } };
    } catch (e) { return null; }
  }
  function perfilDesdeCache(pid) {
    if (ME && ME.player) return false;
    var c = leerCachePerfil(pid);
    if (c) { ME = c; return true; }
    return false;
  }

  async function cargarPerfilReal() {
    if (!user) return;
    try {
      var t = await jwt();
      if (!t) return;
      /* 1) vía oficial: RPC current_player_id (definida en db/migrations/05-current-player.sql) */
      var pid = null;
      try {
        var rpc = await fetch(API + '/rpc/current_player_id', { method: 'POST', headers: authHeaders(t), body: '{}' });
        var pidRaw = await rpc.json().catch(function () { return null; });
        var pidTmp = Array.isArray(pidRaw) ? pidRaw[0] : pidRaw;
        pid = (pidTmp && (pidTmp.current_player_id || pidTmp.id)) || pidTmp || null;
      } catch (eRpc) {}
      /* 2) respaldos por identidad Auth0: auth0_sub → vants_links → email */
      if (!pid && user) {
        try {
          if (user.sub) {
            var rp = await fetch(API + '/players?auth0_sub=eq.' + encodeURIComponent(user.sub) + '&select=id&limit=1', { headers: authHeaders(t) });
            var rpr = await rp.json().catch(function () { return []; });
            if (Array.isArray(rpr) && rpr[0]) pid = rpr[0].id;
          }
        } catch (eS) {}
        if (!pid && user.sub) {
          try {
            var vl = await fetch(API + '/vants_links?auth0_sub=eq.' + encodeURIComponent(user.sub) + '&select=player_id&order=connected_at.desc&limit=1', { headers: authHeaders(t) });
            var vlr = await vl.json().catch(function () { return []; });
            if (Array.isArray(vlr) && vlr[0] && vlr[0].player_id) pid = vlr[0].player_id;
          } catch (eV) {}
        }
        if (!pid && user.email) {
          try {
            var pe = await fetch(API + '/players?email=eq.' + encodeURIComponent(user.email) + '&select=id&limit=1', { headers: authHeaders(t) });
            var per = await pe.json().catch(function () { return []; });
            if (Array.isArray(per) && per[0]) pid = per[0].id;
          } catch (eE) {}
        }
      }
      if (!pid) { perfilDesdeCache(null); return; }
      /* lectura de la fila SIEMPRE autenticada: el proxy público vantsdata devuelve 403
         (funciones de Neon deprecadas) y rompía la carga → pedía crear el perfil otra vez.
         Con el JWT de tu sesión la Data API responde directo. */
      var rows = null;
      try {
        var pr = await fetch(API + '/players?id=eq.' + pid + '&limit=1', { headers: authHeaders(t) });
        rows = await pr.json().catch(function () { return null; });
      } catch (eRow) {}
      if (!Array.isArray(rows) || !rows[0]) {
        /* último intento por el proxy público, por si vuelve a estar vivo */
        try {
          var px = await fetch(PROXY + '?table=players&id=eq.' + pid + '&limit=1', { headers: { Accept: 'application/json' } });
          rows = await px.json().catch(function () { return null; });
        } catch (ePx) {}
      }
      if (!Array.isArray(rows) || !rows[0]) { perfilDesdeCache(pid); return; }
      ME = { pid: pid, player: rows[0], extra: {} };
      guardarCachePerfil(ME);
      try {
        var sp = await fetch(API + '/season_player_stats?player_id=eq.' + pid + '&limit=1', { headers: authHeaders(t) });
        var spRows = await sp.json().catch(function () { return null; });
        ME.extra.sps = (Array.isArray(spRows) && spRows[0]) || null;
      } catch (e2) {}
      try {
        var tGa = await jwt();
        if (tGa) {
          var ga = await fetch(API + '/user_game_accounts?select=game,handle,verified', { headers: authHeaders(tGa) });
          var gaRows = await ga.json().catch(function () { return []; });
          ME.extra.accounts = Array.isArray(gaRows) ? gaRows : [];
        }
      } catch (e3) {}
    } catch (e) { console.warn('[arena] perfil real no disponible', e); perfilDesdeCache(null); }
  }

  function chip(txt, color) { return '<span class="chip" style="color:' + color + ';border-color:' + color + '">' + txt + '</span>'; }

  /* -------- banner del perfil -------- */
  var VMARK = '<svg viewBox="0 0 64 64" style="width:100%;height:auto;display:block"><path d="M12 2H52L62 12V52L52 62H12L2 52V12Z" fill="#191c22" stroke="#ff0d2e" stroke-width="3"/><path d="M9 14H23L34.5 44.5L32 52Z" fill="#e8ecef"/><path d="M55 14H41L32.4 37L42.2 37Z" fill="#ff0d2e"/></svg>';
  function bannerStrip(tipo) {
    if (tipo === 'bananim') return '<div id="pr-banner" style="height:96px;border-radius:10px;overflow:hidden;position:relative;background:#0b0b0e;border:1px solid #3a3f47;margin-bottom:12px">' +
      '<div style="position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,transparent,rgba(255,13,46,.35),transparent);animation:bnlight 2.6s linear infinite"></div>' +
      '<div style="position:absolute;top:0;bottom:0;left:0;width:22%;background:linear-gradient(90deg,transparent,rgba(245,192,68,.25),transparent);animation:bnlight 3.4s linear infinite .9s"></div>' +
      '<div style="position:absolute;left:0;right:0;height:2px;background:#fff;opacity:.14;animation:bnscan 4s linear infinite"></div>' +
      '<div style="position:absolute;right:16px;top:50%;transform:translateY(-50%);width:54px">' + VMARK + '</div></div>';
    if (tipo === 'dorado') return '<div id="pr-banner" style="height:96px;border-radius:10px;overflow:hidden;position:relative;background:linear-gradient(120deg,#3a2c07,#171106 55%,#2a2005);border:1px solid #F5C044;margin-bottom:12px">' +
      '<div style="position:absolute;right:16px;top:50%;transform:translateY(-50%);width:54px">' + VMARK + '</div>' +
      '<div style="position:absolute;left:16px;bottom:10px;font:800 11px var(--mono);letter-spacing:.2em;color:#F5C044">VANTS · EDICIÓN DORADA</div></div>';
    return '<div id="pr-banner" style="height:96px;border-radius:10px;overflow:hidden;position:relative;background:linear-gradient(120deg,#1a1e26,#0e1013);border:1px solid var(--line2,#303039);margin-bottom:12px">' +
      '<div style="position:absolute;right:16px;top:50%;transform:translateY(-50%);width:54px">' + VMARK + '</div></div>';
  }
  function injectBannerCSS() {
    if (document.getElementById('bn-style')) return;
    var st = document.createElement('style'); st.id = 'bn-style';
    st.textContent = '@keyframes bnlight{0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}@keyframes bnscan{0%,100%{top:0}50%{top:calc(100% - 2px)}}';
    document.head.appendChild(st);
  }

  /* -------- RANGO (real) -------- */
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  /* -------- EXPERIENCIA FACEIT (migración 08: players.xp) -------- */
  function xpFaceitHTML(xp) {
    xp = (typeof xp === 'number' && xp > 0) ? xp : 0;
    if (!xp) return '';
    var nivel = 1 + Math.floor(xp / 500);
    var en = xp % 500;
    var f = Math.min(100, (en / 500) * 100);
    return '<p class="d-sec">EXPERIENCIA FACEIT</p>' +
      '<div class="pf-rank" style="--rc:#FF5500">' +
      '<div class="info"><b>NIVEL ' + nivel + '</b><small>' + xp + ' XP TOTAL · ' + en + '/500 PARA EL NIVEL ' + (nivel + 1) + '</small>' +
      '<div class="rr-bar"><i style="width:' + f.toFixed(0) + '%;background:#FF5500"></i></div></div>' +
      '<div class="rr-num">' + nivel + '<small>NIVEL</small></div></div>';
  }

  /* RANGO por XP FACEIT/Valorant (players.xp, el mismo valor que muestra
     EXPERIENCIA FACEIT). Escala acumulativa: FUNDICIÓN <100 · ACERO ≥100 ·
     TITANIO ≥500 · OBSIDIANA ≥1000 · CROMO ≥1500 · PLASMA ≥2250 ·
     ÉTER ≥3000 · APEX ≥4000. Sin Elo/MMR: solo XP ganada. */
  function rangoRealHTML(p) {
    var linea = '<p class="d-sec">RANGO</p>';
    var xpExtra = xpFaceitHTML(p.xp);
    var xp = (typeof p.xp === 'number' && isFinite(p.xp) && p.xp > 0) ? Math.floor(p.xp) : 0;
    var ESCALA = [
      { k: 'fundicion', lo: 0 }, { k: 'acero', lo: 100 }, { k: 'titanio', lo: 500 },
      { k: 'obsidiana', lo: 1000 }, { k: 'cromo', lo: 1500 }, { k: 'plasma', lo: 2250 },
      { k: 'eter', lo: 3000 }, { k: 'vants', lo: 4000 }
    ];
    var fmtXP = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
    try {
      var it = 0, ix;
      for (ix = 0; ix < ESCALA.length; ix++) { if (xp >= ESCALA[ix].lo) it = ix; }
      var t = ESCALA[it], nx = ESCALA[it + 1] || null;
      var rc = RANKS[t.k];
      var f = nx ? Math.max(0, Math.min(100, ((xp - t.lo) / (nx.lo - t.lo)) * 100)) : 100;
      var subTxt = nx ? (fmtXP(nx.lo - xp) + ' XP PARA ' + RANKS[nx.k].name) : 'ESCALA COMPLETA · RANGO MÁXIMO';
      return linea + '<div class="pf-rank" style="--rc:' + rc.c1 + '">' + rankSVG(t.k, 64) +
        '<div class="info"><b>' + rc.name + '</b><small>' + subTxt + '</small>' +
        '<div class="rr-bar"><i style="width:' + f.toFixed(0) + '%;background:' + rc.c1 + '"></i></div></div>' +
        '<div class="rr-num">' + fmtXP(xp) + '<small>XP</small></div></div>' + xpExtra;
    } catch (eR) {
      return linea + '<div class="pf-rank" style="--rc:#5C5C66;opacity:.85">' + rankSVG('fundicion', 64) +
        '<div class="info"><b>FUNDICIÓN</b><small>SIN XP REGISTRADA TODAVÍA</small>' +
        '<div class="rr-bar"><i style="width:0%"></i></div></div>' +
        '<div class="rr-num">0<small>XP</small></div></div>' + xpExtra;
    }
  }

  /* -------- CUENTAS CONECTADAS (real) -------- */
  var DISCORD_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.93-1.51 13.8 13.8 0 0 0-.64 1.28 18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.64-1.28c-1.71.29-3.37.8-4.93 1.51A20.3 20.3 0 0 0 .1 18.06a19.9 19.9 0 0 0 6.07 3.03c.49-.66.93-1.37 1.3-2.1a12.9 12.9 0 0 1-2.05-.98c.17-.12.34-.25.5-.38a14.2 14.2 0 0 0 12.16 0c.16.13.33.26.5.38-.65.39-1.34.72-2.05.98.37.73.81 1.44 1.3 2.1a19.8 19.8 0 0 0 6.07-3.03 20.2 20.2 0 0 0-2.58-13.69ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.96 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z"/></svg>';

  function filaDiscordReal(handle) {
    var conectado = !!handle;
    return '<div class="plat-row' + (conectado ? '' : ' off') + '" style="--pc:#5865F2">' +
      '<span class="plat-ic" style="--plc:#5865F2">' + DISCORD_SVG + '</span>' +
      '<div class="plat-info"><b>DISCORD</b><small>RED SOCIAL · ' + (conectado ? escHtml(handle) : 'NO CONECTADA') + '</small></div>' +
      (conectado
        ? '<span class="plat-state"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>CONECTADO</span>'
        : '<span class="mono" style="font:600 9px/1 var(--mono);color:var(--dim)">—</span>') +
      '</div>';
  }

  function cuentasRealHTML(p) {
    var stats = p.stats || {};
    var acc = (ME.extra && ME.extra.accounts) || [];
    var porJuego = {};
    acc.forEach(function (a) { if (a && a.game) porJuego[a.game] = a; });
    /* whitelist de cuentas esenciales (Discord se dibuja arriba con su fila propia);
       mantener la lista al día = editar solo este arreglo */
    var PLATFORMS = ['twitch', 'youtube', 'riot', 'faceit'];
    var handles = {
      discord: stats.discord_tag || null,
      twitch: p.twitch_channel || null,
      youtube: stats.youtube || null,
      riot: (porJuego.riot && porJuego.riot.handle) || stats.riot || p.summoner_name || null,
      faceit: (porJuego.faceit && porJuego.faceit.handle) || stats.faceit || null,
    };
    var lineas = filaDiscordReal(handles.discord);
    var keys = PLATFORMS;
    try {
      lineas += keys.map(function (k) { return platRow(k, handles[k] || null, !handles[k]); }).join('');
    } catch (eP) {
      lineas += keys.map(function (k) {
        return '<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line,#222);font:600 10px var(--mono)"><span style="color:var(--ink)">' + k.toUpperCase() + '</span><span style="color:' + (handles[k] ? 'var(--grn,#3EE6A0)' : 'var(--dim)') + '">' + (handles[k] ? '✓ ' + escHtml(handles[k]) : '— NO CONECTADA') + '</span></div>';
      }).join('');
    }
    return '<p class="d-sec">CUENTAS CONECTADAS</p><div class="plat-list">' + lineas + '</div>';
  }

  /* -------- TRANSMISIÓN ACTIVA (real) -------- */
  function transmisionRealHTML(p) {
    var canales = [];
    try {
      if (p.twitch_channel) canales.push({ k: 'twitch', h: String(p.twitch_channel).replace(/[^A-Za-z0-9_\-.]/g, ''), url: 'https://www.twitch.tv/' + String(p.twitch_channel).replace(/[^A-Za-z0-9_\-]/g, '') });
      if (p.kick_channel) canales.push({ k: 'kick', h: String(p.kick_channel).replace(/[^A-Za-z0-9_\-.]/g, ''), url: 'https://kick.com/' + String(p.kick_channel).replace(/[^A-Za-z0-9_\-]/g, '') });
    } catch (eC) { return ''; }
    if (!canales.length) return '';
    var c = canales[0];
    try {
      return '<p class="d-sec">TRANSMISIÓN ACTIVA</p>' +
        '<div class="rail-card" style="--plc:' + PLAT[c.k].c + '">' +
        '<div class="rc-top">' + platIc(c.k) +
        '<div class="rc-info"><div class="rc-name">' + escHtml((p.display_name || p.username || 'JUGADOR').toUpperCase()) + '</div>' +
        '<p class="rc-title">Canal vinculado · ' + escHtml(c.h) + '</p></div></div>' +
        '<div class="rc-foot"><span class="rc-view"><i data-lucide="radio"></i><b>' + PLAT[c.k].n + '</b></span>' +
        '<a class="rc-game" href="' + c.url + '" target="_blank" rel="noopener" style="color:var(--ink,#EDEDE7);text-decoration:none">VER STREAM</a></div></div>' +
        (canales.length > 1 ? '<div style="font:500 9.5px/1.6 var(--mono);color:var(--dim);margin-top:6px">También en ' + canales.slice(1).map(function (x) { return PLAT[x.k].n + ': ' + escHtml(x.h); }).join(' · ') + '</div>' : '');
    } catch (eT) { return ''; }
  }

  /* banner superior del perfil real: misma pieza del demo (pf-banner) +skins del pase.
     SIN emblema de rango: el rango ya vive en la sección RANGO del perfil (D21). */
  function pfBannerHTML(sel, rawRank) {
    /* la imagen viva manda (se refleja al instante al subirla/quitarla) */
    var foto = (typeof window.VANTS_BANNER_FOTO === 'string' && window.VANTS_BANNER_FOTO.indexOf('data:image') === 0) ? window.VANTS_BANNER_FOTO : null;
    if (!foto && ME.player.stats && typeof ME.player.stats.banner_foto === 'string' && ME.player.stats.banner_foto.indexOf('data:image') === 0) foto = ME.player.stats.banner_foto;
    return '<div class="pf-banner" id="pf-banner-real">' +
      (foto ? '<img src="' + foto + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">' : '') +
      (!foto && sel === 'bananim' ? '<div style="position:absolute;top:0;bottom:0;left:0;width:30%;background:linear-gradient(90deg,transparent,rgba(255,13,46,.30),transparent);animation:bnlight 2.6s linear infinite"></div>' : '') +
      (!foto && sel === 'dorado' ? '<div style="position:absolute;inset:0;background:linear-gradient(120deg,rgba(58,44,7,.55),rgba(23,17,6,.2) 55%,rgba(42,32,5,.55))"></div>' : '') +
      (((ME.player.twitch_channel) || (ME.player.kick_channel)) ? '<span class="live-chip"><i data-lucide="radio"></i>CANAL VINCULADO</span>' : '') +
      '</div>';
  }

  /* -------- MI EQUIPO (datos + foto editables por el dueño del perfil).
     Vive en stats.equipo={nombre,tag,foto} de la fila del jugador: sin
     migración, el PATCH autenticado ya lo guarda (RLS own-row). ---- */
  function equipoDe(p) {
    try {
      var e = p && p.stats && p.stats.equipo;
      if (e && typeof e === 'object' && e.nombre) {
        return {
          nombre: String(e.nombre).slice(0, 40),
          tag: String(e.tag || '').slice(0, 5).toUpperCase(),
          foto: (typeof e.foto === 'string' && e.foto.indexOf('data:image') === 0) ? e.foto : null
        };
      }
    } catch (eX) {}
    return null;
  }
  function fotoEquipoHTML(eq) {
    if (eq && eq.foto) return '<img src="' + eq.foto + '" alt="" style="width:100%;height:100%;object-fit:cover">';
    return escHtml(((eq && eq.tag) || 'EQ').slice(0, 3));
  }
  /* foto del equipo: recorte cuadrado + redimensionado local (≤170KB como dataURL) */
  function fotoEquipoDataURL(file, cb) {
    try {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var S = 256, cv = document.createElement('canvas');
            cv.width = S; cv.height = S;
            var cx = cv.getContext('2d');
            var lado = Math.min(img.width, img.height);
            cx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, S, S);
            var url = cv.toDataURL('image/jpeg', 0.82);
            if (url.length > 170000) url = cv.toDataURL('image/jpeg', 0.6);
            if (url.length > 170000) {
              var cv2 = document.createElement('canvas'); cv2.width = 128; cv2.height = 128;
              cv2.getContext('2d').drawImage(cv, 0, 0, 128, 128);
              url = cv2.toDataURL('image/jpeg', 0.6);
            }
            cb(url);
          } catch (eC) { cb(null); }
        };
        img.onerror = function () { cb(null); };
        img.src = fr.result;
      };
      fr.onerror = function () { cb(null); };
      fr.readAsDataURL(file);
    } catch (eF) { cb(null); }
  }

  /* imagen del banner: redimensiona a 1200×400 (recorte centrado), JPEG ≤ ~200KB */
  function bannerFotoDataURL(file, cb) {
    try {
      var frB = new FileReader();
      frB.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var W = 1200, H = 400, cv = document.createElement('canvas');
            cv.width = W; cv.height = H;
            var cx = cv.getContext('2d');
            var esc = Math.max(W / img.width, H / img.height);
            var w = img.width * esc, h = img.height * esc;
            cx.drawImage(img, (img.width - w) / 2, (img.height - h) / 2, w, h, 0, 0, W, H);
            var url = cv.toDataURL('image/jpeg', 0.8);
            if (url.length > 200000) url = cv.toDataURL('image/jpeg', 0.62);
            if (url.length > 200000) {
              var cv2 = document.createElement('canvas'); cv2.width = 800; cv2.height = 267;
              cv2.getContext('2d').drawImage(cv, 0, 0, 800, 267);
              url = cv2.toDataURL('image/jpeg', 0.62);
            }
            cb(url);
          } catch (eC) { cb(null); }
        };
        img.onerror = function () { cb(null); };
        img.src = frB.result;
      };
      frB.onerror = function () { cb(null); };
      frB.readAsDataURL(file);
    } catch (eF) { cb(null); }
  }

  function perfilRealHTML() {
    var p = ME.player;
    var stats = p.stats || {};
    /* banner: todos pueden elegir skin (ANIMADO/DORADO/CLÁSICO) y subir SU
       imagen (se redimensiona localmente y vive en stats.banner_foto). */
    var bannerFoto = (typeof stats.banner_foto === 'string' && stats.banner_foto.indexOf('data:image') === 0) ? stats.banner_foto : null;
    var bannerSel = bannerFoto ? 'foto' : (stats.banner || 'bananim');
    window.VANTS_BANNER = bannerSel;
    window.VANTS_BANNER_FOTO = bannerFoto;
    injectBannerCSS();
    /* color del anillo y del banner: tier del rating real (RANKS/rankFor) */
    var sps = (ME.extra && ME.extra.sps) || null;
    var raw = null;
    try { raw = (typeof ratingDe === 'function') ? ratingDe(p) : ((typeof p.rating === 'number' && p.rating > 0) ? p.rating : null); } catch (eRl2) { raw = (typeof p.rating === 'number' && p.rating > 0) ? p.rating : null; }
    if (raw == null && sps && sps.rank != null && sps.rank !== '' && !isNaN(parseFloat(sps.rank)) && parseFloat(sps.rank) >= 0.5 && parseFloat(sps.rank) <= 2) raw = parseFloat(sps.rank);
    var rk = 'fundicion', rc = RANKS.fundicion;
    try {
      if (raw != null && typeof RANKS !== 'undefined') rc = RANKS[rankFor(raw)];
    } catch (eR) { rc = RANKS.fundicion; }

    /* insignias reales con el MISMO chip del demo (badgeChip) */
    var badges = [];
    if (p.verified) badges.push('verified');
    if (p.role === 'owner' || esOwner) badges.push('owner');
    if (p.role === 'admin') badges.push('admin');
    if (p.role === 'streamer') badges.push('streamer');
    if (p.role === 'creator') badges.push('creator');
    if (p.role === 'partner') badges.push('partner');
    if (esOwner) badges = badges.concat(['pro', 'creator', 'partner']);
    badges = badges.filter(function (b, ix) { return badges.indexOf(b) === ix; });

    /* stats reales con el MISMO grid del demo (pf-stats) */
    var wins = (sps && sps.wins) || stats.wins || 0, losses = (sps && sps.losses) || stats.losses || 0;
    var mPartidos = (stats.matches != null ? stats.matches : (sps && sps.wins != null ? wins + losses : null));
    var mWr = (wins + losses > 0) ? Math.round((wins / (wins + losses)) * 100) : (stats.wr != null ? stats.wr : null);
    var mRtg = (raw != null ? raw : (stats.rtg != null ? stats.rtg : null));
    var mKd = (stats.kd != null ? stats.kd : null);
    var cell = function (v, lbl) { return '<div><b>' + (v == null ? '—' : escHtml(v)) + '</b><span>' + lbl + '</span></div>'; };
    var fmt = function (v) { return (typeof v === 'number') ? v.toFixed(2) : v; };
    var statsGrid = '<div class="pf-stats">' + cell(mPartidos, 'PARTIDOS') + cell(mWr == null ? null : mWr + '%', 'WINRATE') + cell(mRtg == null ? null : fmt(mRtg), 'RATING') + cell(mKd == null ? null : fmt(mKd), 'K/D') + '</div>';

    var membre = 'MIEMBRO DESDE 2024';
    try { if (p.created_at) membre = 'MIEMBRO DESDE ' + String(p.created_at).slice(0, 4); } catch (eD) {}
    var ava = p.avatar_url
      ? '<img src="' + escHtml(p.avatar_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
      : escHtml((p.username || 'V').slice(0, 2).toUpperCase());
    var bio = stats.bio || 'Nuevo en el circuito VANTS. Conectá tus cuentas, ganá series y subí de rango.';

    var inp = 'width:100%;background:#0d0d10;border:1px solid var(--line2,#303039);color:var(--ink,#EDEDE7);padding:11px 12px;font:500 12px var(--mono)';
    var bs = 'font:700 10px/1 var(--mono);letter-spacing:.08em;padding:10px 12px;cursor:pointer;background:#0d0d10;border:1px solid var(--line2,#303039);color:var(--mut,#93939D)';
    var btnEdit = '<button id="rp-editar-datos" class="btn btn-sm" aria-label="Editar mis datos" title="Editar mis datos" style="font:700 9px/1 var(--mono);letter-spacing:.08em;padding:6px 9px;cursor:pointer;background:#0d0d10;border:1px solid var(--line2,#303039);color:var(--mut,#93939D)">EDITAR MIS DATOS</button>';
    return '<div class="d-head"><span class="kicker">PERFIL DE JUGADOR</span><button class="d-x" onclick="closeDrawer()"><i data-lucide="x"></i></button></div>' +
      '<div class="d-body" style="--rc:' + rc.c1 + '">' +
      pfBannerHTML(bannerSel, raw) +
      '<div class="pf-head">' +
        '<span class="ava s2" style="--rc:' + rc.c1 + '">' + ava + '</span>' +
        '<div class="pf-id"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div class="pf-name">' + escHtml((p.display_name || p.username || 'JUGADOR').toUpperCase()) + '</div>' + btnEdit + '</div>' +
        '<p class="pf-sub">@' + escHtml(p.username || '') + ' · ' + escHtml(p.country || '—') + (p.region ? ' · ' + escHtml(p.region) : '') + ' · ' + membre + '</p></div></div>' +
      '<p class="d-sec">MI EQUIPO · NOMBRE Y FOTO</p>' +
      '<input type="file" id="rp-eq-file" accept="image/*" hidden>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">' +
        '<span id="rp-eq-prev" style="width:56px;height:56px;flex:none;border-radius:10px;border:1px solid var(--line2,#303039);overflow:hidden;display:flex;align-items:center;justify-content:center;background:#141419;font:800 15px var(--mono);color:var(--accent)">' + fotoEquipoHTML(equipoDe(p)) + '</span>' +
        '<div style="flex:1;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn-sm" id="rp-eq-foto" style="' + bs + '">SUBIR FOTO</button>' +
          (equipoDe(p) && equipoDe(p).foto ? '<button class="btn btn-sm" id="rp-eq-sinfoto" style="' + bs + '">QUITAR FOTO</button>' : '') +
        '</div>' +
      '</div>' +
      '<input id="rp-eq-nombre" placeholder="Nombre del equipo" maxlength="40" value="' + escHtml(equipoDe(p) ? equipoDe(p).nombre : '') + '" style="' + inp + 'margin-bottom:10px">' +
      '<input id="rp-eq-tag" placeholder="Tag del equipo (2-5 letras)" maxlength="5" value="' + escHtml(equipoDe(p) ? equipoDe(p).tag : '') + '" style="' + inp + 'margin-bottom:12px">' +
      '<button class="btn btn-sm" id="rp-eq-guardar" style="width:100%;justify-content:center;background:#FF0D2E;color:#fff;border:0;font:700 11px var(--mono);padding:12px;cursor:pointer;letter-spacing:.08em">GUARDAR MI EQUIPO</button>' +
      '<div id="rp-eq-msg" style="font:500 11px/1.6 var(--mono);color:var(--mut);margin-top:10px;white-space:pre-wrap"></div>' +
      '<p class="d-sec">BANNER DEL PERFIL</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
      '<button class="btn btn-sm" data-banner="bananim" style="' + bs + '">ANIMADO</button>' +
      '<button class="btn btn-sm" data-banner="dorado" style="' + bs + '">DORADO</button>' +
      '<button class="btn btn-sm" data-banner="" style="' + bs + '">CLÁSICO</button>' +
      '<button class="btn btn-sm" id="rp-bn-foto" style="' + bs + '">SUBIR IMAGEN</button>' +
      (bannerFoto ? '<button class="btn btn-sm" id="rp-bn-sinfoto" style="' + bs + '">QUITAR IMAGEN</button>' : '') +
      '</div>' +
      '<input type="file" id="rp-bn-file" accept="image/*" hidden>' +
      '<div id="rp-bn-msg" style="font:500 10.5px/1.7 var(--mono);color:var(--mut);margin-bottom:12px"></div>' +
      cuentasRealHTML(p) +
      '<div id="rp-datos">' +
      '<p class="d-sec">MIS DATOS</p>' +
      '<input id="rp-pais" placeholder="País" value="' + escHtml(p.country || '') + '" style="' + inp + 'margin-bottom:10px">' +
      '<input id="rp-region" placeholder="Región (LATAM, EU…)" value="' + escHtml(p.region || '') + '" style="' + inp + 'margin-bottom:10px">' +
      '<input id="rp-dc" placeholder="Tu tag de Discord (usuario#1234)" value="' + escHtml(stats.discord_tag || '') + '" style="' + inp + 'margin-bottom:12px">' +
      '<button class="btn btn-sm" id="rp-guardar" style="width:100%;justify-content:center;background:#FF0D2E;color:#fff;border:0;font:700 11px var(--mono);padding:12px;cursor:pointer;letter-spacing:.08em">GUARDAR MIS DATOS</button>' +
      '<div id="rp-msg" style="font:500 11px/1.6 var(--mono);color:var(--mut);margin-top:10px;white-space:pre-wrap"></div>' +
      '</div>' +
      '<div class="pf-badges">' + (badges.length ? badges.map(function (b) { return badgeChip(b); }).join('') : '<span class="mono" style="font:500 10px/1.6 var(--mono);color:var(--dim)">Todavía no tenés insignias. Activá un plan o verificá tu identidad para emitir la primera.</span>') + '</div>' +
      '<p class="pf-bio">' + escHtml(bio) + '</p>' +
      statsGrid +
      rangoRealHTML(p) +
      '<div id="rp-faceit"></div>' +
      transmisionRealHTML(p) +
      '<p class="d-sec">MEMBRESÍA</p>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line2,#303039);background:rgba(255,13,46,.05);padding:12px">' +
        '<div><b style="font:800 11px var(--mono);color:var(--ink,#EDEDE7);letter-spacing:.06em">' + (esOwner ? 'VANTS PRO · OWNER' : ((me && me.plan) ? me.plan : 'VANTS FREE')) + '</b><br><span style="font:500 9.5px var(--mono);color:var(--mut,#93939D)">' + (esOwner ? 'Dueño de la arena: todo el contenido premium desbloqueado' : 'Tu plan actual acompaña a tu perfil') + '</span></div>' +
        '<button class="btn btn-ghost btn-sm" id="rp-planes" style="flex:none">VER MEMBRESÍAS</button>' +
      '</div>' +
      '<p class="d-sec">ESTADO EN VIVO</p>' +
      '<div id="rp-pres" style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-sm" data-pres2="online" style="' + bs + '">EN LÍNEA</button>' +
        '<button class="btn btn-sm" data-pres2="jugando" style="' + bs + '">JUGANDO</button>' +
        '<button class="btn btn-sm" data-pres2="ausente" style="' + bs + '">INVISIBLE</button>' +
      '</div>' +
      '<p class="d-sec">MIS INSCRIPCIONES</p>' +
      '<div id="rp-equipos" style="font:500 10.5px/1.7 var(--mono);color:var(--dim,#5C5C66);margin-bottom:4px">Cargando…</div>' +
      '<p class="d-sec">CUENTA</p>' +
      '<div style="font:500 11px/1.8 var(--mono);color:var(--mut)">Rol en VANTS: <b style="color:var(--ink)">' + escHtml(p.role ? p.role.toUpperCase() : 'JUGADOR') + '</b><br>Verificado: <b style="color:' + (p.verified ? 'var(--grn)' : 'var(--dim)') + '">' + (p.verified ? 'SÍ' : 'NO') + '</b><br>Correo: ' + escHtml((user && user.email) || '—') + '</div>' +
      '<button class="btn btn-ghost btn-sm" id="rp-ajustes" style="margin-top:14px;width:100%;justify-content:center;background:none;border:1px solid var(--line2);color:var(--ink);font:700 10px var(--mono);padding:11px;cursor:pointer;letter-spacing:.1em">AJUSTES DE CUENTA · EMAIL · CONTRASEÑA</button>' +
      '<button class="btn btn-ghost btn-sm" id="rp-salir" style="margin-top:8px;width:100%;justify-content:center;background:none;border:1px solid var(--line2);color:var(--ink);font:700 10px var(--mono);padding:11px;cursor:pointer;letter-spacing:.1em">CERRAR SESIÓN</button>' +
      '</div>';
  }

  /* -------- FACEIT · ÚLTIMAS PARTIDAS (XP + rango por partida real) --------
     Lee faceit_matches (lectura pública con RLS) y muestra las últimas
     partidas procesadas por el cron faceit-xp.yml. */
  async function cargarFaceitReal() {
    var host = document.getElementById('rp-faceit');
    if (!host || !ME || !ME.pid) return;
    try {
      var t = await jwt();
      if (!t) return;
      var r = await fetch(API + '/faceit_matches?player_id=eq.' + encodeURIComponent(ME.pid) + '&order=played_at.desc&limit=6', { headers: { Accept: 'application/json', [AUTH_FIELD]: AUTH_SCHEME + t } });
      var rows = await r.json().catch(function () { return null; });
      if (!Array.isArray(rows) || !rows.length) { host.innerHTML = ''; return; }
      var html = '<p class="d-sec">FACEIT · ÚLTIMAS PARTIDAS</p>';
      html += rows.map(function (m) {
        var xp = m.xp_awarded || 0;
        var res = m.result === 'win'
          ? '<b style="color:var(--grn,#3EE6A0)">VICTORIA</b>'
          : (m.result === 'draw' ? '<b style="color:var(--gold,#F5C044)">EMPATE</b>' : '<b style="color:#FF0D2E">DERROTA</b>');
        var fecha = m.played_at ? String(m.played_at).slice(0, 10) : '';
        return '<div style="display:flex;justify-content:space-between;gap:8px;font:500 10.5px/1.7 var(--mono);color:var(--mut);border-bottom:1px solid var(--line,#222);padding:6px 0">'
          + '<span>' + res + ' <span style="color:var(--dim)">' + String(m.game || 'cs2').toUpperCase() + ' · ' + escHtml(fecha) + '</span></span>'
          + '<span style="color:' + (xp > 0 ? 'var(--grn,#3EE6A0)' : 'var(--dim)') + '">' + (xp > 0 ? '+' + xp : '+0') + ' XP</span></div>';
      }).join('');
      host.innerHTML = html;
    } catch (eF) { /* sin FACEIT todavía: no se muestra nada */ }
  }

  async function renderPerfilReal() {
    if (typeof linksCargar === 'function') { try { await linksCargar(); } catch (eL) {} }
    revisarOwnerDiscord();
    if (window.VANTS_ME && ME && ME.player) window.VANTS_ME.player = ME.player;
    if (typeof renderAccount === 'function') { try { renderAccount(); } catch (eRA2) {} }
    openDrawer(perfilRealHTML());
    if (window.lucide) lucide.createIcons();
    /* EDITAR MIS DATOS: scroll suave al formulario MIS DATOS + foco en su primer input */
    var edBtn = document.getElementById('rp-editar-datos');
    if (edBtn) edBtn.onclick = function () {
      var sec = document.getElementById('rp-datos');
      if (!sec) return;
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var first = document.getElementById('rp-pais');
      if (first) { try { first.focus({ preventScroll: true }); } catch (eFo) { first.focus(); } }
    };
    cargarFaceitReal();
    if (typeof completarClipsFicha === 'function' && ME && ME.player) { try { completarClipsFicha(ME.player); } catch (eCl) {} }
    var p = ME.player;
    var msg = document.getElementById('rp-msg');
    var g = document.getElementById('rp-guardar');
    if (g) g.onclick = async function () {
      g.disabled = true; g.textContent = 'GUARDANDO…';
      try {
        var t = await jwt();
        var statsNuevos = Object.assign({}, p.stats || {}, { discord_tag: $('#rp-dc').value.trim(), banner: window.VANTS_BANNER || '', banner_foto: window.VANTS_BANNER_FOTO || null });
        var r = await fetch(API + '/players?id=eq.' + ME.pid, {
          method: 'PATCH',
          headers: authHeaders(t),
          body: JSON.stringify({ country: $('#rp-pais').value.trim(), region: $('#rp-region').value.trim(), stats: statsNuevos }),
        });
        if (r.ok) {
          p.country = $('#rp-pais').value.trim(); p.region = $('#rp-region').value.trim(); p.stats = statsNuevos;
          g.textContent = '✓ GUARDADO EN NEON';
          if (msg) msg.textContent = '';
          if (typeof toast === 'function') { try { toast('Perfil actualizado en Neon'); } catch (e3) {} }
        } else {
          var j = await r.json().catch(function () { return {}; });
          if (msg) msg.textContent = 'La base rechazó el guardado (HTTP ' + r.status + '): ' + (j.message || '') + '\nPlan B: UPDATE players SET country=…, region=… WHERE id=\'' + ME.pid + '\'; en el SQL Editor de Neon.';
          g.textContent = 'ERROR — ver mensaje';
        }
      } catch (e) { if (msg) msg.textContent = 'Error de red: ' + e; }
      setTimeout(function () { g.disabled = false; g.textContent = 'GUARDAR MIS DATOS'; }, 1800);
    };
    /* ---- MI EQUIPO: subir/quitar foto (se redimensiona localmente), nombre, tag ---- */
    var eqFile = document.getElementById('rp-eq-file');
    var eqFotoBtn = document.getElementById('rp-eq-foto');
    var eqPrev = document.getElementById('rp-eq-prev');
    var EQ_FOTO = (equipoDe(p) || {}).foto || null;
    function eqMsg(t) { var m = document.getElementById('rp-eq-msg'); if (m) m.textContent = t || ''; }
    function wireQuitar(q) {
      if (!q) return;
      q.onclick = function () {
        EQ_FOTO = null;
        if (eqPrev) eqPrev.textContent = 'EQ';
        q.remove();
      };
    }
    if (eqFotoBtn && eqFile) eqFotoBtn.onclick = function () { eqFile.click(); };
    if (eqFile) eqFile.onchange = function () {
      var f = eqFile.files && eqFile.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type || '')) { eqMsg('Ese archivo no es una imagen'); return; }
      if (eqFotoBtn) { eqFotoBtn.disabled = true; eqFotoBtn.textContent = 'PROCESANDO…'; }
      fotoEquipoDataURL(f, function (url) {
        if (eqFotoBtn) { eqFotoBtn.disabled = false; eqFotoBtn.textContent = 'SUBIR FOTO'; }
        if (!url) { eqMsg('No se pudo leer la imagen'); return; }
        EQ_FOTO = url;
        if (eqPrev) eqPrev.innerHTML = '<img src="' + url + '" alt="" style="width:100%;height:100%;object-fit:cover">';
        var q = document.getElementById('rp-eq-sinfoto');
        if (!q && eqFotoBtn && eqFotoBtn.parentNode) {
          q = document.createElement('button');
          q.id = 'rp-eq-sinfoto'; q.className = 'btn btn-sm';
          q.style.cssText = 'font:700 10px/1 var(--mono);letter-spacing:.08em;padding:10px 12px;cursor:pointer;background:#0d0d10;border:1px solid var(--line2,#303039);color:var(--mut,#93939D)';
          q.textContent = 'QUITAR FOTO';
          eqFotoBtn.parentNode.appendChild(q);
        }
        wireQuitar(q);
      });
    };
    wireQuitar(document.getElementById('rp-eq-sinfoto'));
    var eqG = document.getElementById('rp-eq-guardar');
    if (eqG) eqG.onclick = async function () {
      var nombre = (((document.getElementById('rp-eq-nombre') || {}).value) || '').trim();
      var tag = (((document.getElementById('rp-eq-tag') || {}).value) || '').trim().toUpperCase();
      eqG.disabled = true; eqG.textContent = 'GUARDANDO…';
      try {
        var tEq = await jwt();
        var statsEq = Object.assign({}, p.stats || {});
        if (!nombre && !tag && !EQ_FOTO) {
          delete statsEq.equipo; /* sin nada: se quita el equipo del perfil */
        } else {
          if (!nombre) { eqG.disabled = false; eqG.textContent = 'GUARDAR MI EQUIPO'; eqMsg('Escribí el nombre del equipo'); return; }
          statsEq.equipo = { nombre: nombre.slice(0, 40), tag: tag.slice(0, 5), foto: EQ_FOTO };
        }
        var rEq = await fetch(API + '/players?id=eq.' + ME.pid, { method: 'PATCH', headers: authHeaders(tEq), body: JSON.stringify({ stats: statsEq }) });
        if (rEq.ok) {
          p.stats = statsEq;
          eqG.textContent = '✓ EQUIPO GUARDADO EN NEON';
          eqMsg('');
          if (typeof toast === 'function') { try { toast(statsEq.equipo ? 'Mi equipo guardado: la foto ya vive en tu perfil' : 'Equipo quitado del perfil'); } catch (eE1) {} }
          renderPerfilReal();
        } else {
          var jEq = await rEq.json().catch(function () { return {}; });
          eqMsg('La base rechazó el guardado (HTTP ' + rEq.status + '): ' + (jEq.message || ''));
          eqG.textContent = 'ERROR — ver mensaje';
        }
      } catch (eEq) { eqMsg('Error de red: ' + eEq); eqG.textContent = 'GUARDAR MI EQUIPO'; }
      setTimeout(function () { var gg = document.getElementById('rp-eq-guardar'); if (gg) { gg.disabled = false; gg.textContent = 'GUARDAR MI EQUIPO'; } }, 1800);
    };
    var s = document.getElementById('rp-salir');
    if (s) s.onclick = function () { A0.logout({ logoutParams: { returnTo: RAIZ } }); };
    var aj = document.getElementById('rp-ajustes');
    if (aj) aj.onclick = function () { closeDrawer(); if (window.openAjustesCuenta) window.openAjustesCuenta(); };
    /* ---- BANNER: skins ANIMADO/DORADO/CLÁSICO + imagen propia, con AUTO-GUARDADO
       (cada clic persiste en stats.banner / stats.banner_foto vía PATCH propio) ---- */
    var bnMsg = function (t) { var m = document.getElementById('rp-bn-msg'); if (m) m.textContent = t || ''; };
    async function guardarBanner() {
      try {
        var tB = await jwt();
        if (!tB) { bnMsg('Iniciá sesión para guardar el banner'); return; }
        var statsB = Object.assign({}, p.stats || {}, { banner: window.VANTS_BANNER || '', banner_foto: window.VANTS_BANNER_FOTO || null });
        var rB = await fetch(API + '/players?id=eq.' + ME.pid, { method: 'PATCH', headers: authHeaders(tB), body: JSON.stringify({ stats: statsB }) });
        if (rB.ok) { p.stats = statsB; bnMsg('✓ Banner guardado en tu perfil'); }
        else {
          var jb = await rB.json().catch(function () { return {}; });
          bnMsg('La base rechazó el banner (HTTP ' + rB.status + ')' + (jb.message ? ': ' + jb.message : ''));
        }
      } catch (eBS) { bnMsg('Error de red al guardar el banner'); }
    }
    function repintarBanner() {
      var rawRank = (typeof p.rating === 'number' && p.rating > 0) ? p.rating
        : (((ME.extra && ME.extra.sps) && ME.extra.sps.rank != null && !isNaN(parseFloat(ME.extra.sps.rank))) ? parseFloat(ME.extra.sps.rank) : null);
      var pf = document.getElementById('pf-banner-real');
      if (pf) pf.outerHTML = pfBannerHTML(window.VANTS_BANNER, rawRank);
      if (window.lucide) lucide.createIcons();
    }
    document.querySelectorAll('[data-banner]').forEach(function (b) {
      b.onclick = function () {
        window.VANTS_BANNER = b.getAttribute('data-banner');
        if (window.VANTS_BANNER === 'foto' && !window.VANTS_BANNER_FOTO) window.VANTS_BANNER = 'bananim';
        repintarBanner();
        document.querySelectorAll('[data-banner]').forEach(function (x) { x.style.borderColor = 'var(--line2,#303039)'; x.style.color = 'var(--mut,#93939D)'; });
        b.style.borderColor = '#FF0D2E'; b.style.color = '#FF0D2E';
        bnMsg('Guardando banner…');
        guardarBanner();
      };
    });
    var bnFotoBtn = document.getElementById('rp-bn-foto');
    var bnFile = document.getElementById('rp-bn-file');
    if (bnFotoBtn && bnFile) bnFotoBtn.onclick = function () { bnFile.click(); };
    if (bnFile) bnFile.onchange = function () {
      var f = bnFile.files && bnFile.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type || '')) { bnMsg('Ese archivo no es una imagen'); return; }
      if (bnFotoBtn) { bnFotoBtn.disabled = true; bnFotoBtn.textContent = 'PROCESANDO…'; }
      bnMsg('Redimensionando imagen…');
      bannerFotoDataURL(f, function (urlB) {
        if (bnFotoBtn) { bnFotoBtn.disabled = false; bnFotoBtn.textContent = 'SUBIR IMAGEN'; }
        if (!urlB) { bnMsg('No se pudo leer la imagen'); return; }
        window.VANTS_BANNER_FOTO = urlB;
        window.VANTS_BANNER = 'foto';
        repintarBanner();
        bnMsg('Guardando banner…');
        guardarBanner();
        if (!document.getElementById('rp-bn-sinfoto') && bnFotoBtn && bnFotoBtn.parentNode) {
          var qb = document.createElement('button');
          qb.id = 'rp-bn-sinfoto'; qb.className = 'btn btn-sm';
          qb.style.cssText = 'font:700 10px/1 var(--mono);letter-spacing:.08em;padding:10px 12px;cursor:pointer;background:#0d0d10;border:1px solid var(--line2,#303039);color:var(--mut,#93939D)';
          qb.textContent = 'QUITAR IMAGEN';
          bnFotoBtn.parentNode.appendChild(qb);
          qb.onclick = function () {
            window.VANTS_BANNER_FOTO = null;
            window.VANTS_BANNER = 'bananim';
            qb.remove();
            repintarBanner();
            bnMsg('Guardando banner…');
            guardarBanner();
          };
        }
      });
    };
    var bnQuitar = document.getElementById('rp-bn-sinfoto');
    if (bnQuitar) bnQuitar.onclick = function () {
      window.VANTS_BANNER_FOTO = null;
      window.VANTS_BANNER = 'bananim';
      bnQuitar.remove();
      repintarBanner();
      bnMsg('Guardando banner…');
      guardarBanner();
    };

    /* ---- MEMBRESÍA · PRESENCIA · INSCRIPCIONES (fusionados de MI CUENTA) ---- */
    var rpPlanes = document.getElementById('rp-planes');
    if (rpPlanes) rpPlanes.onclick = function () { closeDrawer(); var pb = document.getElementById('plansBtn'); if (pb) pb.click(); };
    var presAct = (function () { try { return localStorage.getItem('vants_presencia') || 'online'; } catch (eP1) { return 'online'; } })();
    function pintarPresFicha() {
      document.querySelectorAll('#rp-pres [data-pres2]').forEach(function (x) {
        var on = x.getAttribute('data-pres2') === presAct;
        x.style.borderColor = on ? '#FF0D2E' : 'var(--line2,#303039)';
        x.style.color = on ? '#FF0D2E' : 'var(--mut,#93939D)';
      });
    }
    document.querySelectorAll('#rp-pres [data-pres2]').forEach(function (x) {
      x.onclick = function () {
        presAct = x.getAttribute('data-pres2');
        try { localStorage.setItem('vants_presencia', presAct); } catch (eP2) {}
        if (window.vantsPresenciaSet) { try { window.vantsPresenciaSet(presAct); } catch (eP3) {} }
        pintarPresFicha();
        if (typeof toast === 'function') { try { toast('Estado en vivo: ' + (presAct === 'ausente' ? 'INVISIBLE' : (presAct === 'jugando' ? 'JUGANDO' : 'EN LÍNEA'))); } catch (eP4) {} }
      };
    });
    pintarPresFicha();
    (async function () {
      var hostEq = document.getElementById('rp-equipos');
      if (!hostEq) return;
      try {
        var tEq = await jwt();
        var subEq = (window.VANTS_AUTH && window.VANTS_AUTH.sub) || null;
        if (!tEq || !subEq) { hostEq.textContent = 'Aún no inscribiste ningún equipo.'; return; }
        var rEq = await fetch(API + '/tournament_teams?auth0_sub=eq.' + encodeURIComponent(subEq) + '&order=created_at.desc&limit=8', { headers: authHeaders(tEq) });
        var filasEq = await rEq.json().catch(function () { return null; });
        if (!Array.isArray(filasEq) || !filasEq.length) { hostEq.textContent = 'Aún no inscribiste ningún equipo. Cuando inscribas uno, aparece acá y en el bracket.'; return; }
        hostEq.innerHTML = filasEq.map(function (eE) {
          return '<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--line,#222);padding:5px 0"><span><b style="color:var(--ink,#EDEDE7)">' + escHtml(String(eE.name || 'EQUIPO').toUpperCase()) + '</b> [' + escHtml(String(eE.tag || '').toUpperCase()) + ']</span><span style="color:var(--grn,#3EE6A0)">' + escHtml(String(eE.status || '').toUpperCase()) + '</span></div>';
        }).join('');
      } catch (eEq) { hostEq.textContent = ''; }
    })();
  }
  /* vista previa del perfil real sin sesión (solo dibuja el drawer con
     datos que se le pasan; toda escritura real exige JWT + RLS) */
  window.__previewPerfilReal = function (fake) {
    var f = fake || {};
    ME = { pid: f.id || 'preview', player: f, extra: ME && ME.extra || {} };
    if (f._esOwner) esOwner = true;
    renderPerfilReal();
  };

  /* PERFIL DE JUGADOR único (MI CUENTA): cuando tu propia ficha se abre desde
     el chip de cuenta, la Sala o VER MI PERFIL, se muestra ESTA misma ficha
     editable — sin drawer "EDITAR PERFIL" aparte. */
  window.vantsFichaPropia = function (p) {
    try {
      if (!p) { if (window.vantsAbrirMiPerfil) window.vantsAbrirMiPerfil(); return; }
      if (!ME) ME = { pid: null, player: null, extra: {} };
      ME.player = p;
      if (!ME.pid) ME.pid = p.id;
      if (window.VANTS_AUTH && !window.VANTS_AUTH.playerId) window.VANTS_AUTH.playerId = p.id;
      renderPerfilReal();
    } catch (eFP) {
      if (window.vantsAbrirMiPerfil) window.vantsAbrirMiPerfil();
    }
  };

  function renderCrearPerfil(nombreSugerido) {
    var inp = 'width:100%;background:#0d0d10;border:1px solid var(--line2,#303039);color:var(--ink,#EDEDE7);padding:11px 12px;font:500 12px var(--mono)';
    openDrawer('<div class="d-head"><span class="kicker">MI PERFIL · PRIMERA VEZ</span><button class="d-x" onclick="closeDrawer()"><i data-lucide="x"></i></button></div>' +
      '<div class="d-body">' +
      '<p style="font:500 12px/1.7 var(--mono);color:var(--mut);margin:16px 0">Crea tu jugador oficial en la base de VANTS. Se guarda en Neon y queda ligado a tu cuenta.</p>' +
      '<input id="cp-user" placeholder="Tu usuario (nick)" value="' + escHtml(nombreSugerido || '') + '" style="' + inp + 'margin-bottom:10px">' +
      '<input id="cp-pais" placeholder="País" style="' + inp + 'margin-bottom:10px">' +
      '<input id="cp-region" placeholder="Región (LATAM, EU…)" style="' + inp + 'margin-bottom:12px">' +
      '<button class="btn btn-sm" id="cp-crear" style="width:100%;justify-content:center;background:#FF0D2E;color:#fff;border:0;font:700 11px var(--mono);padding:12px;cursor:pointer;letter-spacing:.08em">CREAR MI PERFIL EN NEON</button>' +
      '<div id="cp-msg" style="font:500 11px/1.6 var(--mono);color:var(--mut);margin-top:12px;white-space:pre-wrap"></div>' +
      '</div>');
    if (window.lucide) lucide.createIcons();
    var c = document.getElementById('cp-crear');
    var msg = document.getElementById('cp-msg');
    c.onclick = async function () {
      c.disabled = true; c.textContent = 'CREANDO…';
      try {
        var t = await jwt();
        /* la creación viaja con la identidad Auth0 para que Neon la ligue a la sesión.
           BONUS DE BIENVENIDA: rating 0.95 (ACERO I) + registro del bonus en stats,
           así los nuevos ya aparecen en el ranking con rango y puntos desde el día 1. */
        var r = await fetch(API + '/players', {
          method: 'POST',
          headers: authHeaders(t),
          body: JSON.stringify({ username: $('#cp-user').value.trim().toLowerCase().replace(/\s+/g, '_'), display_name: $('#cp-user').value.trim(), country: $('#cp-pais').value.trim(), region: $('#cp-region').value.trim(), avatar_url: (user && user.picture) || null, auth0_sub: (user && user.sub) || null, email: (user && user.email) || null, rating: 0.95, stats: { bonus_novato: { rr: 100, fecha: new Date().toISOString().slice(0, 10) } } }),
        });
        var listo = r.ok;
        var adoptado = false;
        if (!listo && (r.status === 409 || r.status === 400)) {
          /* nick ya existía: intentar ADOPTAR ese perfil ligándolo a esta identidad */
          try {
            var nick = $('#cp-user').value.trim().toLowerCase().replace(/\s+/g, '_');
            var ex = await fetch(API + '/players?username=eq.' + encodeURIComponent(nick) + '&select=id,auth0_sub,rating&limit=1', { headers: authHeaders(t) });
            var exRows = await ex.json().catch(function () { return []; });
            if (Array.isArray(exRows) && exRows[0] && !exRows[0].auth0_sub) {
              var cuerpo = { auth0_sub: (user && user.sub) || null, email: (user && user.email) || null };
              /* si el perfil adoptado no tiene rating, también recibe el bonus novato */
              if (exRows[0].rating == null) cuerpo.rating = 0.95;
              var up = await fetch(API + '/players?id=eq.' + exRows[0].id, {
                method: 'PATCH', headers: authHeaders(t),
                body: JSON.stringify(cuerpo),
              });
              if (up.ok) { listo = true; adoptado = true; }
            }
          } catch (eAd) {}
        }
        if (listo) {
          if (msg) msg.innerHTML = '<span class="ok">✓ Perfil ' + (adoptado ? 'recuperado' : 'creado') + ' · bonus de bienvenida: <b>ACERO I + 100 RR</b>. Cargando…</span>';
          if (typeof toast === 'function') { try { toast('Puntos de bienvenida: empezás en ACERO I con +100 RR'); } catch (eB2) {} }
          await cargarPerfilReal();
          if (ME && ME.player) renderPerfilReal();
          if (typeof window.vantsRecargarJugadores === 'function') { try { window.vantsRecargarJugadores(); } catch (eR2) {} }
        } else {
          var j = r.ok ? {} : await r.json().catch(function () { return {}; });
          if (msg) msg.textContent = 'La base rechazó la creación (HTTP ' + r.status + '): ' + (j.message || '') + '\nPlan B: crea el jugador en el SQL Editor de Neon.';
          c.disabled = false; c.textContent = 'REINTENTAR';
        }
      } catch (e) { if (msg) msg.textContent = 'Error de red: ' + e; c.disabled = false; }
    };
  }

  /* PERFIL DE JUGADOR: la ficha editable es el único perfil. Esta función
     queda como respaldo (creación de perfil o carga inicial desde Neon). */
  window.vantsAbrirMiPerfil = function () {
    if (!user) {
      var lbm = document.getElementById('arenaLoginBtn');
      if (lbm && !lbm.hidden) lbm.click();
      else if (typeof toast === 'function') { try { toast('Ingresá con ENTRAR para crear tu perfil de jugador', 'info'); } catch (eL2) {} }
      return;
    }
    if (ME && ME.player) { renderPerfilReal(); return; }
    openDrawer('<div class="d-head"><span class="kicker">MI PERFIL</span><button class="d-x" onclick="closeDrawer()"><i data-lucide="x"></i></button></div><div class="d-body"><p style="font:500 12px/1.7 var(--mono);color:var(--mut);margin:18px 0">Cargando tu perfil real desde Neon…</p></div>');
    (async function () {
      await cargarPerfilReal();
      if (ME && ME.player) renderPerfilReal();
      else renderCrearPerfil(String((user && (user.name || user.email)) || '').split('@')[0]);
    })();
  };
  if (accBtn) accBtn.addEventListener('click', function () {
    /* UN SOLO PERFIL: el chip de la cuenta abre la ficha de jugador
       (con la sección TU CUENTA → editar banner/datos y ajustes). */
    if (user && ME && ME.player && window.openPlayerProfile) {
      try { window.openPlayerProfile(ME.player); return; } catch (ePf) {}
    }
    window.vantsAbrirMiPerfil();
  });

  try { if (typeof linksCargar === 'function') { await linksCargar(); } } catch (eL0) {}
  revisarOwnerDiscord();
  await cargarPerfilReal();

  if (window.VANTS_AUTH) window.VANTS_AUTH.playerId = (ME && ME.pid) || null;
  /* el chip de la nav muestra el PERFIL REAL (nombre y foto de Neon) */
  if (ME && ME.player) {
    window.VANTS_ME = { pid: ME.pid, player: ME.player, owner: esOwner };
    if (typeof renderAccount === 'function') { try { renderAccount(); } catch (eRA) {} }
  }

  if (user) {
    if (loginBtn) loginBtn.hidden = true;
    if (accBtn) accBtn.hidden = false;
    /* MENÚ solo para registrados: con sesión el botón MENÚ aparece */
    var menuBtnSesion = document.getElementById('menuBtn');
    if (menuBtnSesion) menuBtnSesion.hidden = false;
    var nm = String(user.name || user.nickname || user.email || 'JUGADOR').split('@')[0].toUpperCase();
    var nombreReal = (ME && ME.player) ? String(ME.player.display_name || ME.player.username || nm) : nm;
    var ava = document.getElementById('accAva');
    var accName = document.getElementById('accName');
    var dot = document.getElementById('accLive');
    if (ava) {
      if (ME && ME.player && ME.player.avatar_url) ava.innerHTML = '<img alt="" src="' + escHtml(ME.player.avatar_url) + '">';
      else ava.textContent = nombreReal.slice(0, 2);
    }
    if (accName) accName.textContent = esOwner ? nombreReal.toUpperCase() : nombreReal.slice(0, 12).toUpperCase();
    if (dot) dot.style.display = 'none';
    if (typeof toast === 'function') { try { toast(esOwner ? '👑 Modo DUEÑO activo — todo el contenido premium gratis' : 'Sesión iniciada como ' + nm); } catch (e3) {} }

    if (esOwner) {
      (async function () {
        /* Fila del owner por el sub de SU sesión. El hardcode viejo
           (username=eq.geimerpedroza) quedó huérfano cuando la fila se
           renombró a feispla: devolvía vacío, dejaba VANTS_ME.player=null
           y VANTS_AUTH.playerId roto (el nick no guardaba en Neon). Si la
           búsqueda por sub no encuentra fila, NO se pisa lo que ya cargó
           cargarPerfilReal (sub → vants_links → email). */
        var filaOwner = null;
        try {
          var tO = null;
          try { tO = await jwt(); } catch (eT0) {}
          if (tO && user && user.sub) {
            var prO = await fetch(API + '/players?auth0_sub=eq.' + encodeURIComponent(user.sub) + '&limit=1', { headers: authHeaders(tO) });
            var rowsO = await prO.json().catch(function () { return []; });
            if (Array.isArray(rowsO) && rowsO[0]) filaOwner = rowsO[0];
          }
        } catch (eOw) {}
        if (filaOwner) window.VANTS_ME = { pid: filaOwner.id, player: filaOwner, owner: true };
        else window.VANTS_ME = { pid: (ME && ME.pid) || null, player: (ME && ME.player) || null, owner: true };
        try { if (window.VANTS_AUTH) window.VANTS_AUTH.playerId = (window.VANTS_ME && window.VANTS_ME.pid) || null; } catch (eVA) {}
        /* activa plan VANTS PRO gratis + insignias OWNER/CREADOR/SOCIO (motor en arena.js) */
        try { if (window.vantsOwnerActivate) window.vantsOwnerActivate(); } catch (eVO) {}
        try {
          if (typeof state !== 'undefined') { state.isPro = true; }
        } catch (e) {}
      })();
    }
  } else if (loginBtn && !esArchivo) {
    if (accBtn) accBtn.hidden = true;
    loginBtn.hidden = false;
    loginBtn.addEventListener('click', function () {
      loginBtn.disabled = true;
      A0.loginWithRedirect({ authorizationParams: { redirect_uri: location.origin + location.pathname.replace(/[^/]*$/, ''), scope: 'openid profile email' } }).catch(function () { loginBtn.disabled = false; });
    });
  }

  var DB = window.VantDB;
  if (!DB) return;
  function liveBadge(on, n) {
    var el = document.getElementById('liveDataBadge');
    if (!el) return;
    el.innerHTML = on ? '<span class="dot"></span>DATOS EN VIVO · NEON · ' + n + ' TORNEOS' : 'CALENDARIO S4 · FECHAS POR ANUNCIAR';
    el.classList.toggle('on', !!on);
  }
  try {
    var rows = await DB.tournaments();
    if (Array.isArray(rows) && rows.length) {
      var list = rows.map(function (t) {
        var d = t.starts_at ? new Date(t.starts_at) : null;
        return { id: String(t.slug || t.id), day: d ? String(d.getDate()).padStart(2, '0') : '—', mon: d ? d.toLocaleString('es-ES', { month: 'short' }).replace('.', '').toUpperCase() : '', name: t.name || 'Torneo VANTS', tier: String(t.tier || 'open').toUpperCase(), tags: [String(t.status || 'abierto').toUpperCase()], prize: (t.prize_pool == null ? null : Number(t.prize_pool) || 0), slots: (t.max_participants == null ? null : Number(t.max_participants) || 0), filled: Number(t.current_participants) || 0, fee: 0 };
      });
      ['valorant', 'cs2'].forEach(function (g) { if (DATA[g]) DATA[g].tournaments = list; });
      if (typeof renderTournaments === 'function') renderTournaments();
      liveBadge(true, list.length);
    } else { liveBadge(false, 0); }
  } catch (e) { console.warn('[arena] Neon no disponible', e); liveBadge(false, 0); }

  /* [ELIMINADO] sincronización del Pase competitivo (sección removida del sitio). */
})();
