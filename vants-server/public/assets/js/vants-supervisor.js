/* VANTS SUPERVISOR v1 — captura de errores JS, fallos de red, pageviews y logins
   de la web para el Supervisor Bot (embeds al DM de Discord).

   Configuración (una sola línea): pon abajo la URL de la Neon Function `supervisor`
   después de desplegarla (ver docs/SUPERVISOR.md). Mientras esté vacía, el SDK
   se apaga solo y la web funciona exactamente igual que hoy.

   Nunca lanza excepciones: todo el código está envuelto para no romper la web jamás. */
(function () {
  'use strict';
  if (window.VantsSupervisor) return;

  /* ── CONFIGURACIÓN ─────────────────────────────────────────────────────────
     Pega aquí la URL de tu función Neon `supervisor`, por ejemplo:
     'https://br-sweet-shape-b42xhogj-supervisor.compute.c-6.us-east-2.aws.neon.tech' */
  var COLLECTOR = String(window.VANTS_SUPERVISOR_URL || '').replace(/\/+$/, '');
  if (!COLLECTOR && /^https?:$/.test(location.protocol) &&
      location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    COLLECTOR = location.origin + '/api/telemetria';
  }

  var PAGE = /panel\.html$/i.test(location.pathname) ? 'panel' : 'arena';
  var ACTIVO = !!(COLLECTOR && location.protocol !== 'file:');

  /* id de sesión por visita (para agrupar eventos del mismo usuario) */
  var sid = 's_anon';
  try {
    sid = sessionStorage.getItem('vantsSid') || '';
    if (!sid) {
      sid = 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      sessionStorage.setItem('vantsSid', sid);
    }
  } catch (e) { /* sessionStorage bloqueado */ }

  var cola = [];
  var marcas = [];            /* marcas de tiempo de la ventana de rate-limit (60 s) */
  var firmaPrev = {};         /* dedupe cliente: misma firma en <3 s se ignora */
  var MAX_COLA = 20;
  var MAX_POR_MIN = 30;

  function dentroLimite() {
    var t = Date.now();
    while (marcas.length && t - marcas[0] > 60000) marcas.shift();
    return marcas.length < MAX_POR_MIN;
  }

  function sanea(d) {
    var out = {};
    for (var k in d) {
      if (!Object.prototype.hasOwnProperty.call(d, k)) continue;
      var v = d[k];
      if (v == null) { out[k] = null; continue; }
      if (typeof v === 'number' || typeof v === 'boolean') { out[k] = v; continue; }
      out[k] = String(v).slice(0, 300);
    }
    return out;
  }

  /* API pública: window.VantsSupervisor.event('TIPO', {campo: valor}) */
  function event(tipo, datos) {
    try {
      if (!ACTIVO) return;
      if (!dentroLimite()) return;
      var firma = tipo + '|' + JSON.stringify(datos || {}).slice(0, 200);
      if (firmaPrev[firma] && Date.now() - firmaPrev[firma] < 3000) return;
      firmaPrev[firma] = Date.now();
      marcas.push(Date.now());
      cola.push({
        event_id: 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        kind: String(tipo || 'EVENTO').slice(0, 40),
        page: PAGE,
        session_id: sid,
        url: String(location.href).slice(0, 300),
        referrer: String(document.referrer || '').slice(0, 200),
        data: sanea(datos || {}),
      });
      if (cola.length > MAX_COLA) cola = cola.slice(-MAX_COLA);
      programarFlush();
    } catch (e) { /* nunca romper la web */ }
  }

  var timer = null;
  function programarFlush() {
    if (timer || !ACTIVO) return;
    timer = setTimeout(function () { timer = null; flush(); }, 3500);
  }

  function flush() {
    try {
      if (!ACTIVO || !cola.length) return;
      var lote = cola.splice(0, cola.length);
      var body = JSON.stringify({ page: PAGE, session_id: sid, events: lote });
      var destino = /\/api\/telemetria$/i.test(COLLECTOR) ? COLLECTOR : COLLECTOR + '/events';
      var enCola = false;
      try {
        if (navigator.sendBeacon) {
          enCola = navigator.sendBeacon(destino, new Blob([body], { type: 'application/json' }));
        }
      } catch (eB) { enCola = false; }
      if (!enCola) {
        fetch(destino, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Vants-Supervisor': 'web' },
          body: body,
          keepalive: true,
          mode: 'cors',
        }).catch(function () {});
      }
    } catch (e) { /* silencio total */ }
  }

  window.VantsSupervisor = {
    event: event,
    flush: flush,
    page: function () { return PAGE; },
    enabled: function () { return ACTIVO; },
  };

  if (!ACTIVO) return;

  /* ── ERRORES JS (window.onerror + promesas rechazadas) ── */
  window.addEventListener('error', function (ev) {
    try {
      var e = ev && ev.error ? ev.error : null;
      event('JS_ERROR', {
        message: String((e && e.message) || (ev && ev.message) || 'error').slice(0, 250),
        stack: String((e && e.stack) || '').slice(0, 600),
        file: [ev && ev.filename, ev && ev.lineno, ev && ev.colno].filter(Boolean).join(':'),
      });
    } catch (err) { /* silencio */ }
  });
  window.addEventListener('unhandledrejection', function (ev) {
    try {
      var r = ev && ev.reason;
      event('JS_ERROR', {
        message: String((r && r.message) || r || 'unhandledrejection').slice(0, 250),
        stack: String((r && r.stack) || '').slice(0, 600),
        motivo: 'unhandledrejection',
      });
    } catch (err) { /* silencio */ }
  });

  /* ── FALLOS DE RED (interceptor de fetch: 5xx y rechazos) ── */
  try {
    if (typeof window.fetch === 'function' && !window.fetch.__vantsWrapped) {
      var origFetch = window.fetch;
      var envuelto = function (input, init) {
        var t0 = Date.now();
        var url = '';
        try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (eU) {}
        var p = origFetch.apply(this, arguments);
        p.then(function (res) {
          try {
            if (res && res.status >= 500) {
              event('NETWORK_ERROR', { endpoint: String(url).slice(0, 200), status: res.status, ms: Date.now() - t0, motivo: 'status_' + res.status });
            }
          } catch (eR) { /* silencio */ }
        }).catch(function (err) {
          try {
            if (String(url).indexOf(COLLECTOR) !== -1) return; /* no autocapturar el propio supervisor */
            event('NETWORK_ERROR', { endpoint: String(url).slice(0, 200), status: 0, ms: Date.now() - t0, motivo: String((err && err.message) || 'fetch_reject').slice(0, 120) });
          } catch (eC) { /* silencio */ }
        });
        return p;
      };
      envuelto.__vantsWrapped = true;
      window.fetch = envuelto;
    }
  } catch (eF) { /* silencio */ }

  /* ── MOVIMIENTOS (pageviews + rutas hash de la SPA) ── */
  try { event('PAGE_VIEW', { vista: (location.hash || '#/inicio').slice(0, 120) }); } catch (eP) {}
  window.addEventListener('hashchange', function () {
    try { event('PAGE_VIEW', { vista: (location.hash || '').slice(0, 120) }); } catch (eH) {}
  });

  /* ── ENVÍO al ocultar/cerrar la pestaña ── */
  window.addEventListener('pagehide', function () { try { flush(); } catch (e1) {} });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { try { flush(); } catch (e2) {} }
  });
})();
